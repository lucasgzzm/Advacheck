import logging
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from .. import esquemas, modelos
from ..base_datos import get_db
from ..dependencias import obtener_usuario_actual
from ..config import UPLOAD_DIR
from ..servicio_extraccion import ExtractorService
from ..servicio_texto import AITextService
from ..servicio_validacion_cruzada import ServicioValidacionCruzada
from ..servicio_prevalidacion import ServicioPrevalidacionAduanera, evaluar_confianza_extraccion, verificar_cuadratura_items

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/facturas", tags=["Facturas"])


@router.post("/", response_model=esquemas.FacturaResponse, status_code=status.HTTP_201_CREATED)
async def registrar_y_evaluar_factura(
    factura_req: esquemas.FacturaCreate,
    envio_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Registra una factura y ejecuta la prevalidación aduanera."""
    evaluacion_dict = ServicioPrevalidacionAduanera.ejecutar(factura_req.model_dump())
    eval_observaciones = "; ".join([e.get("resumen", "") for e in evaluacion_dict.get("etapas", []) if e.get("resumen")])
    nivel_riesgo_general = evaluacion_dict.get("riesgo_global", "BAJO")

    nueva_factura = modelos.Factura(
        numero_factura=factura_req.numero_factura,
        fecha_emision=factura_req.fecha_emision,
        monto_total=factura_req.monto_total,
        moneda=factura_req.moneda,
        emisor_nombre=factura_req.emisor_nombre,
        riesgo_calculado=nivel_riesgo_general,
        observaciones_riesgo=eval_observaciones,
        envio_id=envio_id,
    )
    db.add(nueva_factura)
    await db.flush()

    for item_req in factura_req.detalles:
        # Se usa el motor completo ahora. Simulamos el resultado para compatibilidad de DB
        evaluacion_item_inconsistente = False
        evaluacion_item_sugerencia_partida = "0000.00.00.00"
        nuevo_item = modelos.FacturaDetalle(
            descripcion_producto=item_req.descripcion_producto,
            cantidad=item_req.cantidad,
            precio_unitario=item_req.precio_unitario,
            partida_arancelaria_sugerida=evaluacion_item_sugerencia_partida,
            inconsistente=evaluacion_item_inconsistente,
            factura_id=nueva_factura.id,
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
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Extrae datos de una factura PDF y evalúa su riesgo."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se admiten archivos PDF.",
        )

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

        evaluacion_dict = ServicioPrevalidacionAduanera.ejecutar(datos_extraidos)
        eval_observaciones = "; ".join([e.get("resumen", "") for e in evaluacion_dict.get("etapas", []) if e.get("resumen")])
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
                )
                db.add(nuevo_log)

                from ..servicio_auditoria import registrar_auditoria
                await registrar_auditoria(db, usuario_actual.id, "Análisis de Documento", f"Extracción y evaluación de riesgo para '{file.filename}'.")

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


@router.post("/scan-multi")
async def escanear_multiples_documentos(
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Valida múltiples documentos con cruce de datos."""
    if len(files) < 2:
        raise HTTPException(
            status_code=400, detail="Se requieren al menos 2 documentos para la validación cruzada."
        )
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Máximo 5 documentos permitidos.")

    for f in files:
        if not f.filename.endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Solo se admiten archivos PDF.")

    try:
        # 1. Extraer y estructurar cada PDF individualmente
        factura: Optional[dict] = None
        packing_list: Optional[dict] = None
        bl: Optional[dict] = None

        for f in files:
            contenido = await f.read()
            datos = await ExtractorService.extract_from_pdf(contenido)
            tipo_doc = (datos.get("tipo_documento") or "").upper()

            if "COMERCIAL_INVOICE" in tipo_doc or "FACTURA" in tipo_doc or "INVOICE" in tipo_doc:
                factura = datos
            elif "PACKING" in tipo_doc or "EMPAQUE" in tipo_doc or "PACK" in tipo_doc:
                packing_list = datos
            elif "BILL" in tipo_doc or "BL" in tipo_doc or "BOL" in tipo_doc or \
                 "GUIA" in tipo_doc or "AEREA" in tipo_doc or "AIR" in tipo_doc:
                bl = datos
            else:
                # Heurística por nombre de archivo si Gemini no clasificó
                nombre = f.filename.lower()
                if "packing" in nombre or "empaque" in nombre:
                    packing_list = packing_list or datos
                elif "bl" in nombre or "bill" in nombre or "guia" in nombre or "aerea" in nombre:
                    bl = bl or datos
                elif "factura" in nombre or "invoice" in nombre:
                    factura = factura or datos
                else:
                    # Asignación por orden: factura→packing→bl
                    if factura is None:
                        factura = datos
                    elif packing_list is None:
                        packing_list = datos
                    else:
                        bl = bl or datos

        if factura is None:
            raise HTTPException(
                status_code=400,
                detail="No se pudo identificar una Factura Comercial entre los documentos subidos.",
            )

        # 2. Ejecutar validación cruzada programática
        resultado = ServicioValidacionCruzada.ejecutar(
            factura=factura,
            packing_list=packing_list,
            bl=bl,
        )

        # 3. Auditoría
        docs_str = ", ".join(
            d for d in [
                "Factura" if factura else None,
                "Packing List" if packing_list else None,
                "B/L" if bl else None,
            ] if d
        )
        await registrar_auditoria(db, usuario_actual.id, "Validación Cruzada", (
                f"Validación cruzada de {len(files)} documento(s): {docs_str}. "
                f"{len(resultado.lista_discrepancias)} discrepancia(s) encontrada(s)."
            ))
        await db.commit()

        # 3. Ejecutar prevalidación aduanera completa (7 etapas)
        prevalidacion = ServicioPrevalidacionAduanera.ejecutar(
            factura=factura or {},
            packing_list=packing_list,
            bl=bl,
        )

        # 4. Confianza de extracción + cuadratura de ítems
        confianza = evaluar_confianza_extraccion(factura or {})
        cuadratura = verificar_cuadratura_items(factura or {})

        return {
            "status": "success",
            "data": {
                "validacion_cruzada": resultado.model_dump(),
                "prevalidacion": prevalidacion,
                "confianza": confianza,
                "cuadratura_items": cuadratura,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error en validación cruzada: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado durante la validación: {str(e)}",
        )


@router.post("/clasificar-item")
async def clasificar_item_arancelario(
    payload: dict,
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Clasifica un producto en su partida arancelaria vía IA."""
    descripcion = payload.get("descripcion_producto")
    if not descripcion:
        raise HTTPException(status_code=400, detail="Falta la descripción del producto.")

    res = await AITextService.classify_item(descripcion)
    if not res:
        raise HTTPException(
            status_code=500, detail="Error al invocar al motor de clasificación IA."
        )
    return res
