import copy
import logging
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from .. import esquemas, modelos
from ..base_datos import get_db
from ..dependencias import obtener_usuario_actual
from ..configuracion import UPLOAD_DIR
from ..services.servicio_extraccion import ExtractorService
from ..services.servicio_texto import AITextService
from ..services.servicio_prevalidacion import ServicioPrevalidacionAduanera, evaluar_confianza_extraccion, verificar_cuadratura_items

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/facturas", tags=["Facturas"])


@router.post("/scan")
async def escanear_factura_pdf(
    guardar: bool = True,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Procesa un PDF de factura: extrae los datos con IA, evalua el riesgo,
    ejecuta las 7 etapas de prevalidacion, y guarda el resultado en la base de datos.
    """
    from datetime import datetime, timedelta
    from sqlalchemy import func, and_, select

    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se admiten archivos PDF.",
        )

    # Verifica si ya existe un documento con el mismo nombre y usuario en las últimas 24h
    hora_hace_24h = datetime.utcnow() - timedelta(hours=24)
    resultado_dup = await db.execute(
        select(modelos.DocumentoProcesado.id)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == usuario_actual.id,
            modelos.DocumentoProcesado.nombre_archivo == file.filename,
            modelos.DocumentoProcesado.fecha_analisis >= hora_hace_24h,
        ))
        .limit(1)
    )
    doc_existente = resultado_dup.scalar_one_or_none()
    if doc_existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un análisis para '{file.filename}' (ID: {doc_existente}). Abre el documento existente desde tu historial.",
        )

    hora_hace_60_min = datetime.utcnow() - timedelta(hours=1)
    resultado_limite = await db.execute(
        select(func.count())
        .select_from(modelos.DocumentoProcesado)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == usuario_actual.id,
            modelos.DocumentoProcesado.fecha_analisis >= hora_hace_60_min
        ))
    )
    usados = resultado_limite.scalar() or 0
    if usados >= 20:
        raise HTTPException(status_code=429, detail="Límite de documentos procesados por hora alcanzado")

    try:
        contenido = await file.read()
        datos_extraidos = await ExtractorService.extract_from_pdf(contenido)

        factura_mock = esquemas.FacturaCreate(
            numero_factura=datos_extraidos.get("numero_factura", "N/A"),
            fecha_emision=None,
            monto_total=datos_extraidos.get("monto_total_cif", 0.0),
            moneda=datos_extraidos.get("moneda", "USD"),
            incoterm=datos_extraidos.get("incoterm"),
            pais_origen=datos_extraidos.get("pais_origen"),
            monto_subtotal=datos_extraidos.get("monto_subtotal", 0.0),
            monto_flete=datos_extraidos.get("monto_flete", 0.0),
            monto_seguro=datos_extraidos.get("monto_seguro", 0.0),
            monto_otros_gastos=datos_extraidos.get("monto_otros_gastos", 0.0),
            peso_bruto=datos_extraidos.get("pesos", {}).get("bruto", 0.0),
            peso_neto=datos_extraidos.get("pesos", {}).get("neto", 0.0),
            emisor_nombre=datos_extraidos.get("emisor", {}).get("nombre", "Desconocido"),
            emisor_tax_id=datos_extraidos.get("emisor", {}).get("tax_id"),
            receptor_nombre=datos_extraidos.get("receptor", {}).get("nombre"),
            receptor_tax_id=datos_extraidos.get("receptor", {}).get("tax_id"),
            receptor_pais=datos_extraidos.get("receptor", {}).get("pais"),
            detalles=[
                esquemas.FacturaDetalleCreate(
                    descripcion_producto=d["descripcion_producto"],
                    cantidad=d["cantidad"],
                    precio_unitario=d["precio_unitario"],
                )
                for d in datos_extraidos.get("detalles", [])
            ],
        )

        # Ejecuta el motor de prevalidacion (7 etapas) y guarda el resultado completo
        evaluacion_dict = ServicioPrevalidacionAduanera.ejecutar(datos_extraidos)

        # Extrae los mensajes de los controles que fallaron o advirtieron
        fallas = []
        for etapa in evaluacion_dict.get("etapas", []):
            for control in etapa.get("controles", []):
                if control["estado"] in ("FAIL", "WARNING") and control["nombre"] != "scoring_final":
                    fallas.append(control['mensaje'])
        eval_observaciones = " | ".join(fallas) if fallas else "Sin observaciones"

        nivel_riesgo_general = evaluacion_dict.get("riesgo_global", "BAJO")

        items_evaluados = []
        for d in datos_extraidos["detalles"]:
            items_evaluados.append(
                {
                    "descripcion_producto": d["descripcion_producto"],
                    "cantidad": d["cantidad"],
                    "precio_unitario": d["precio_unitario"],
                    "partida_sugerida": d.get("partida_arancelaria_sugerida", "0000.00.00.00"),
                }
            )

        doc_id = None
        if guardar:
            try:
                ruta_rel = None
                os.makedirs(UPLOAD_DIR, exist_ok=True)
                ext = os.path.splitext(file.filename)[1] or ".pdf"
                nombre_archivo_bd = f"{uuid.uuid4()}{ext}"
                ruta_completa = os.path.join(UPLOAD_DIR, nombre_archivo_bd)
                with open(ruta_completa, "wb") as f:
                    f.write(contenido)
                ruta_rel = nombre_archivo_bd

                # Toma una copia de los datos extraídos por la IA para guardarlos
                # como referencia original y poder detectar cambios del usuario
                datos_originales = copy.deepcopy(datos_extraidos)

                nuevo_log = modelos.DocumentoProcesado(
                    nombre_archivo=file.filename,
                    proveedor=datos_extraidos["emisor"].get("nombre", "Desconocido"),
                    cliente=datos_extraidos["receptor"].get("nombre", "Importador"),
                    total_cif=datos_extraidos.get("monto_total_cif", 0),
                    flete=datos_extraidos.get("monto_flete", 0),
                    seguro=datos_extraidos.get("monto_seguro", 0),
                    otros=datos_extraidos.get("monto_otros_gastos", 0),
                    riesgo=nivel_riesgo_general,
                    usuario_id=usuario_actual.id,
                    ruta_archivo=ruta_rel,
                    datos_originales=datos_originales,
                    prevalidacion_resultado=evaluacion_dict,
                    # Campos extra extraídos por OCR
                    fecha_emision=datos_extraidos.get("fecha_emision"),
                    moneda=datos_extraidos.get("moneda", "USD"),
                    monto_subtotal=datos_extraidos.get("monto_subtotal", 0),
                    remitente_dir=datos_extraidos["emisor"].get("direccion", ""),
                    remitente_doc=datos_extraidos["emisor"].get("tax_id", ""),
                    destinatario_dir=datos_extraidos["receptor"].get("direccion", ""),
                    transporte_pais=datos_extraidos["emisor"].get("pais", ""),
                    transporte_metodo=datos_extraidos.get("transporte_metodo", "No detectado"),
                    peso_bruto=datos_extraidos.get("pesos", {}).get("bruto", 0),
                    peso_neto=datos_extraidos.get("pesos", {}).get("neto", 0),
                    numero_factura=datos_extraidos.get("numero_factura", "N/A"),
                    incoterm=datos_extraidos.get("incoterm"),
                    pais_origen=datos_extraidos.get("pais_origen"),
                )
                db.add(nuevo_log)

                from ..services.servicio_auditoria import registrar_auditoria
                await registrar_auditoria(db, usuario_actual.id, "Analisis de Documento", f"Extraccion y evaluacion de riesgo para '{file.filename}'.")

                await db.flush()

                for i, d in enumerate(items_evaluados):
                    partida = modelos.Partida(
                        documento_id=nuevo_log.id,
                        descripcion=d["descripcion_producto"],
                        cantidad=d["cantidad"],
                        precio_unitario=d["precio_unitario"],
                        partida_sugerida=d["partida_sugerida"],
                        orden=i,
                    )
                    db.add(partida)

                await db.commit()
                await db.refresh(nuevo_log)
                doc_id = nuevo_log.id
            except Exception as error_db:
                print(f"Error guardando historial en BD: {str(error_db)}")

        return {
            "id": doc_id,
            "remitente": {
                "nombre": datos_extraidos["emisor"].get("nombre", "No detectado"),
                "direccion": datos_extraidos["emisor"].get("direccion", "No detectada"),
                "documento": datos_extraidos["emisor"].get("tax_id", "No detectado"),
            },
            "destinatario": {
                "nombre": datos_extraidos["receptor"].get("nombre", "Importador"),
                "direccion": datos_extraidos["receptor"].get("direccion", "No detectada"),
                "documento": datos_extraidos["receptor"].get("tax_id", "No detectado"),
            },
            "factura": {
                "numero": datos_extraidos["numero_factura"],
                "fecha": datos_extraidos["fecha_emision"],
                "moneda": datos_extraidos["moneda"],
                "incoterm": datos_extraidos.get("incoterm"),
                "pais_origen": datos_extraidos.get("pais_origen"),
            },
            "transporte": {
                "paisOrigen": datos_extraidos["emisor"].get("pais", "No detectado"),
                "metodo": "No detectado",
                "courier": "No detectado",
                "tracking": "No detectado",
            },
            "economia": {
                "total": datos_extraidos.get("monto_total_cif", 0),
                "subtotal": datos_extraidos.get("monto_subtotal", 0),
                "envio": datos_extraidos.get("monto_flete", 0),
                "seguro": datos_extraidos.get("monto_seguro", 0),
                "otros": datos_extraidos.get("monto_otros_gastos", 0),
            },
            "logistica": {
                "peso_bruto": datos_extraidos.get("pesos", {}).get("bruto", 0),
                "peso_neto": datos_extraidos.get("pesos", {}).get("neto", 0),
                "unidad_peso": datos_extraidos.get("pesos", {}).get("unidad", "kg"),
            },
            "riesgo": nivel_riesgo_general,
            "observaciones": eval_observaciones,
            "prevalidacion": evaluacion_dict,
            "partidaPrincipal": items_evaluados[0]["partida_sugerida"] if items_evaluados else "No detectada",
            "detalles": items_evaluados,
            "validacion_error": datos_extraidos.get("validacion_error", False),
            "mensaje_error": datos_extraidos.get("mensaje_error", ""),
            "ai_usage": datos_extraidos.get("_ai_metadata"),
            "confianza": evaluar_confianza_extraccion(datos_extraidos),
            "cuadratura_items": verificar_cuadratura_items(datos_extraidos),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando el PDF: {str(e)}",
        )



@router.post("/clasificar-item")
async def clasificar_item_arancelario(
    payload: dict,
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Clasifica un producto en su partida arancelaria usando IA.
    Recibe la descripcion del producto y devuelve la partida sugerida.
    """
    descripcion = payload.get("descripcion_producto")
    if not descripcion:
        raise HTTPException(status_code=400, detail="Falta la descripcion del producto.")

    res = await AITextService.classify_item(descripcion)
    if not res:
        raise HTTPException(
            status_code=500, detail="Error al invocar al motor de clasificacion IA."
        )
    return res
