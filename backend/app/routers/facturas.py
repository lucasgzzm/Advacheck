from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List
from pydantic import BaseModel

from .autenticacion import get_current_user
from .. import esquemas, modelos
from ..base_datos import get_db
from ..servicios import SistemaReglasAduaneras
from ..servicio_extraccion import ExtractorService

router = APIRouter(
    prefix="/api/facturas",
    tags=["Facturas"]
)


@router.post("/", response_model=esquemas.FacturaResponse, status_code=status.HTTP_201_CREATED)
async def registrar_y_evaluar_factura(factura_req: esquemas.FacturaCreate, envio_id: int, db: AsyncSession = Depends(get_db)):
    """
    Registra una factura manualmente, la evalúa con el motor de reglas
    y persiste el resultado junto con sus ítems en la BD.
    """
    # Evaluar la factura completa con el motor de reglas
    evaluacion_global = SistemaReglasAduaneras.procesar_factura_completa(factura_req)
    
    # Guardar la cabecera de la factura
    nueva_factura = modelos.Factura(
        numero_factura=factura_req.numero_factura,
        fecha_emision=factura_req.fecha_emision,
        monto_total=factura_req.monto_total,
        moneda=factura_req.moneda,
        emisor_nombre=factura_req.emisor_nombre,
        riesgo_calculado=evaluacion_global.nivel_riesgo_general,
        observaciones_riesgo=evaluacion_global.observaciones,
        envio_id=envio_id
    )
    
    db.add(nueva_factura)
    await db.flush()
    
    # Guardar cada ítem evaluado individualmente
    for req_item in factura_req.detalles:
        evaluacion_item = SistemaReglasAduaneras.evaluar_item(req_item)
        nuevo_item = modelos.FacturaDetalle(
            descripcion_producto=req_item.descripcion_producto,
            cantidad=req_item.cantidad,
            precio_unitario=req_item.precio_unitario,
            partida_arancelaria_sugerida=evaluacion_item.sugerencia_partida,
            inconsistente=evaluacion_item.inconsistente,
            factura_id=nueva_factura.id
        )
        db.add(nuevo_item)
        
    await db.commit()
    await db.refresh(nueva_factura)
    
    return nueva_factura


@router.post("/scan")
async def escanear_factura_pdf(
    guardar: bool = True,
    file: UploadFile = File(...), 
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """
    Recibe un PDF, extrae los datos con OCR + Gemini,
    los evalúa con el motor de reglas y devuelve la previsualización.
    Opcionalmente guarda un registro en el historial de documentos procesados.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se admiten archivos PDF."
        )

    try:
        # Leer el contenido binario del archivo
        contenido = await file.read()
        
        # Procesar con el servicio de extracción (OCR + análisis de texto)
        datos_extraidos = await ExtractorService.extract_from_pdf(contenido)
        
        # Adaptar los datos al esquema de evaluación del motor de reglas
        factura_mock = esquemas.FacturaCreate(
            numero_factura=datos_extraidos.get("numero_factura", "N/A"),
            fecha_emision=None, 
            monto_total=datos_extraidos.get("monto_total_cif", 0.0),
            moneda=datos_extraidos.get("moneda", "USD"),
            emisor_nombre=datos_extraidos.get("emisor", {}).get("nombre", "Desconocido"),
            detalles=[
                esquemas.FacturaDetalleCreate(
                    descripcion_producto=d["descripcion_producto"],
                    cantidad=d["cantidad"],
                    precio_unitario=d["precio_unitario"]
                ) for d in datos_extraidos.get("detalles", [])
            ]
        )
        
        # Evaluar riesgo con el motor de reglas
        evaluacion = SistemaReglasAduaneras.procesar_factura_completa(factura_mock)
        
        # Preparar los ítems con las partidas sugeridas
        items_evaluados = []
        for d in datos_extraidos["detalles"]:
            items_evaluados.append({
                "descripcion_producto": d["descripcion_producto"],
                "cantidad": d["cantidad"],
                "precio_unitario": d["precio_unitario"],
                "partida_sugerida": d.get("partida_arancelaria_sugerida", "0000.00.00.00")
            })

        # Guardar en el historial de documentos procesados (si está activado)
        if guardar:
            try:
                nuevo_log = modelos.DocumentoProcesado(
                    nombre_archivo=file.filename,
                    proveedor=datos_extraidos["emisor"].get("nombre", "Desconocido"),
                    cliente=datos_extraidos["receptor"].get("nombre", "Importador"),
                    total_cif=datos_extraidos.get("monto_total_cif", 0),
                    riesgo=evaluacion.nivel_riesgo_general,
                    usuario_id=current_user.id
                )
                db.add(nuevo_log)
                await db.commit()
            except Exception as db_exception:
                print(f"Error guardando historial en BD: {str(db_exception)}")

        # Armar la respuesta para el frontend
        return {
            "remitente": {
                "nombre": datos_extraidos["emisor"].get("nombre", "No detectado"),
                "direccion": datos_extraidos["emisor"].get("direccion", "No detectada"), 
                "documento": datos_extraidos["emisor"].get("tax_id", "No detectado")
            },
            "destinatario": {
                "nombre": datos_extraidos["receptor"].get("nombre", "Importador"),
                "direccion": datos_extraidos["receptor"].get("direccion", "No detectada"),
                "documento": datos_extraidos["receptor"].get("tax_id", "No detectado")
            },
            "factura": {
                "numero": datos_extraidos["numero_factura"],
                "fecha": datos_extraidos["fecha_emision"],
                "moneda": datos_extraidos["moneda"]
            },
            "transporte": {
                "paisOrigen": datos_extraidos["emisor"].get("pais", "No detectado"),
                "metodo": "No detectado",
                "courier": "No detectado",
                "tracking": "No detectado"
            },
            "economia": {
                "total": datos_extraidos.get("monto_total_cif", 0),
                "subtotal": datos_extraidos.get("monto_subtotal", sum(d["cantidad"] * d["precio_unitario"] for d in datos_extraidos["detalles"])),
                "envio": datos_extraidos.get("monto_flete", 0),
                "seguro": datos_extraidos.get("monto_seguro", 0)
            },
            "riesgo": evaluacion.nivel_riesgo_general,
            "observaciones": evaluacion.observaciones,
            "partidaPrincipal": items_evaluados[0]["partida_sugerida"] if items_evaluados else "No detectada", 
            "detalles": items_evaluados,
            "validacion_error": datos_extraidos.get("validacion_error", False),
            "mensaje_error": datos_extraidos.get("mensaje_error", ""),
            "ai_usage": datos_extraidos.get("_ai_metadata")
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando el PDF: {str(e)}"
        )


@router.get("/historial", response_model=List[esquemas.DocumentoProcesadoResponse])
async def obtener_historial_escaneos(
    db: AsyncSession = Depends(get_db), 
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Devuelve el historial de documentos procesados por el usuario actual."""
    result = await db.execute(
        select(modelos.DocumentoProcesado)
        .filter(modelos.DocumentoProcesado.usuario_id == current_user.id)
        .order_by(desc(modelos.DocumentoProcesado.fecha_analisis))
    )
    historial = result.scalars().all()
    return historial


class AprobarPayload(BaseModel):
    nuevo_total: float = None


@router.put("/{factura_id}/aprobar")
async def aprobar_factura(
    factura_id: int, 
    payload: AprobarPayload,
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Marca un documento como aprobado y actualiza su total si se proporcionó uno nuevo."""
    result = await db.execute(
        select(modelos.DocumentoProcesado)
        .filter(modelos.DocumentoProcesado.id == factura_id)
        .filter(modelos.DocumentoProcesado.usuario_id == current_user.id)
    )
    doc = result.scalars().first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El documento no existe o no tienes permisos para modificarlo."
        )
        
    if payload.nuevo_total is not None:
        doc.total_cif = payload.nuevo_total
        
    doc.estado = "Aprobado (Validado)"
    await db.commit()
    return {"mensaje": "Documento aprobado y sincronizado con éxito."}


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_documento(
    doc_id: int, 
    db: AsyncSession = Depends(get_db),
    current_user: modelos.Usuario = Depends(get_current_user)
):
    """Elimina un documento del historial. Solo el dueño puede hacerlo."""
    result = await db.execute(
        select(modelos.DocumentoProcesado)
        .filter(modelos.DocumentoProcesado.id == doc_id)
        .filter(modelos.DocumentoProcesado.usuario_id == current_user.id)
    )
    doc = result.scalars().first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El documento no existe o no tienes permisos para eliminarlo."
        )
    
    await db.delete(doc)
    await db.commit()
    return None

