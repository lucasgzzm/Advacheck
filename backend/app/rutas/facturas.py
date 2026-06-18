import copy
import hashlib
import logging
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from .. import esquemas, modelos
from ..base_datos import get_db
from ..dependencias import obtener_usuario_actual
from ..configuracion import UPLOAD_DIR
from ..servicios.servicio_extraccion import ExtractorService
from ..servicios.servicio_texto import AITextService
from ..servicios.servicio_prevalidacion import ServicioPrevalidacionAduanera, evaluar_confianza_extraccion, verificar_cuadratura_items
from ..servicios.servicio_ocr import OCRService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/facturas", tags=["Facturas"])

MAX_UPLOAD_SIZE = 10 * 1024 * 1024

# Escanea un PDF, extrae datos y evalúa riesgo aduanero
@router.post("/scan")
async def escanear_factura_pdf(
    guardar: bool = True,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func, and_, select

    if not file.filename or not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se admiten archivos PDF.",
        )

    if file.content_type and file.content_type not in ["application/pdf", "application/octet-stream"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser un PDF valido.",
        )

    hora_hace_24h = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)
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

    hora_hace_60_min = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)
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
        if len(contenido) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"El archivo excede el limite de {MAX_UPLOAD_SIZE // (1024 * 1024)}MB.",
            )
        hash_pdf = hashlib.sha256(contenido).hexdigest()

        cache_hit = False
        doc_cacheado = None
        if hash_pdf:
            resultado_cache = await db.execute(
                select(modelos.DocumentoProcesado)
                .where(and_(
                    modelos.DocumentoProcesado.hash_pdf == hash_pdf,
                    modelos.DocumentoProcesado.usuario_id == usuario_actual.id,
                ))
                .limit(1)
            )
            doc_cacheado = resultado_cache.scalar_one_or_none()
            if doc_cacheado and doc_cacheado.datos_originales:
                cache_hit = True
                logger.info(f"Cache HIT para hash {hash_pdf[:12]}... (doc {doc_cacheado.id})")

        if cache_hit:
            datos_extraidos = copy.deepcopy(doc_cacheado.datos_originales)
            evaluacion_dict = copy.deepcopy(doc_cacheado.prevalidacion_resultado) if doc_cacheado.prevalidacion_resultado else None
        else:
            datos_extraidos = await ExtractorService.extract_from_pdf(contenido)

        datos_extraidos.setdefault("emisor", {})
        datos_extraidos.setdefault("receptor", {})
        datos_extraidos.setdefault("detalles", [])
        datos_extraidos.setdefault("pesos", {})

        factura_mock = esquemas.FacturaCreate(
            numero_factura=datos_extraidos.get("numero_factura"),
            fecha_emision=None,
            monto_total=datos_extraidos.get("monto_total_cif", 0.0),
            moneda=datos_extraidos.get("moneda"),
            incoterm=datos_extraidos.get("incoterm"),
            pais_origen=datos_extraidos.get("pais_origen"),
            monto_subtotal=datos_extraidos.get("monto_subtotal", 0.0),
            monto_flete=datos_extraidos.get("monto_flete", 0.0),
            monto_seguro=datos_extraidos.get("monto_seguro", 0.0),
            monto_otros_gastos=datos_extraidos.get("monto_otros_gastos", 0.0),
            peso_bruto=datos_extraidos.get("pesos", {}).get("bruto", 0.0),
            peso_neto=datos_extraidos.get("pesos", {}).get("neto", 0.0),
            emisor_nombre=datos_extraidos.get("emisor", {}).get("nombre"),
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

        if not cache_hit:
            packing_list = datos_extraidos.get("_packing_list")
            bl_data = datos_extraidos.get("_bl_data")
            evaluacion_dict = ServicioPrevalidacionAduanera.ejecutar(
                datos_extraidos,
                packing_list=packing_list,
                bl=bl_data,
            )

        _confianza_detalle = evaluar_confianza_extraccion(datos_extraidos)
        _puntajes = [v for v in _confianza_detalle.values() if isinstance(v, (int, float))]
        _promedio = sum(_puntajes) / len(_puntajes) if _puntajes else 0
        _campos_criticos = sorted(
            [{"campo": k, "puntaje": v} for k, v in _confianza_detalle.items() if v < 60],
            key=lambda x: x["puntaje"],
        )

        if _promedio >= 80 and not _campos_criticos:
            _nivel_confianza = "ALTA"
        elif _promedio >= 50:
            _nivel_confianza = "MEDIA"
        else:
            _nivel_confianza = "BAJA"

        confianza_general = {
            "nivel": _nivel_confianza,
            "promedio": round(_promedio, 1),
            "campos_criticos": _campos_criticos,
            "detalle": _confianza_detalle,
        }

        if evaluacion_dict:
            fallas = []
            for etapa in evaluacion_dict.get("etapas", []):
                for control in etapa.get("controles", []):
                    if control["estado"] in ("FAIL", "WARNING") and control["nombre"] != "scoring_final":
                        fallas.append(control['mensaje'])
            eval_observaciones = " | ".join(fallas) if fallas else "Sin observaciones"
            nivel_riesgo_general = evaluacion_dict.get("riesgo_global", "BAJO")
        else:
            eval_observaciones = "Sin observaciones"
            nivel_riesgo_general = "BAJO"

        items_evaluados = []
        for d in datos_extraidos["detalles"]:
            items_evaluados.append(
                {
                    "descripcion_producto": d["descripcion_producto"],
                    "cantidad": d["cantidad"],
                    "precio_unitario": d["precio_unitario"],
                    "partida_sugerida": d.get("partida_arancelaria_sugerida"),
                }
            )

        doc_id = doc_cacheado.id if cache_hit else None
        if guardar and not cache_hit:
            try:
                ruta_rel = None
                os.makedirs(UPLOAD_DIR, exist_ok=True)
                ext = os.path.splitext(file.filename)[1] or ".pdf"
                nombre_archivo_bd = f"{uuid.uuid4()}{ext}"
                ruta_completa = os.path.join(UPLOAD_DIR, nombre_archivo_bd)
                with open(ruta_completa, "wb") as f:
                    f.write(contenido)
                ruta_rel = nombre_archivo_bd

                datos_originales = copy.deepcopy(datos_extraidos)

                nuevo_log = modelos.DocumentoProcesado(
                    hash_pdf=hash_pdf,
                    nombre_archivo=file.filename,
                    proveedor=datos_extraidos["emisor"].get("nombre"),
                    cliente=datos_extraidos["receptor"].get("nombre"),
                    receptor_tax=datos_extraidos["receptor"].get("tax_id"),
                    total_cif=datos_extraidos.get("monto_total_cif", 0),
                    flete=datos_extraidos.get("monto_flete", 0),
                    seguro=datos_extraidos.get("monto_seguro", 0),
                    otros=datos_extraidos.get("monto_otros_gastos", 0),
                    riesgo=nivel_riesgo_general,
                    usuario_id=usuario_actual.id,
                    ruta_archivo=ruta_rel,
                    datos_originales=datos_originales,
                    prevalidacion_resultado=evaluacion_dict,
                    fecha_emision=datos_extraidos.get("fecha_emision"),
                    moneda=datos_extraidos.get("moneda"),
                    monto_subtotal=datos_extraidos.get("monto_subtotal", 0),
                    remitente_dir=datos_extraidos["emisor"].get("direccion"),
                    remitente_doc=datos_extraidos["emisor"].get("tax_id"),
                    destinatario_dir=datos_extraidos["receptor"].get("direccion"),
                    transporte_pais=datos_extraidos["emisor"].get("pais"),
                    transporte_metodo=datos_extraidos.get("transporte_metodo"),
                    peso_bruto=datos_extraidos.get("pesos", {}).get("bruto", 0),
                    peso_neto=datos_extraidos.get("pesos", {}).get("neto", 0),
                    numero_factura=datos_extraidos.get("numero_factura"),
                    incoterm=datos_extraidos.get("incoterm"),
                    pais_origen=datos_extraidos.get("pais_origen"),
                )
                db.add(nuevo_log)

                from ..servicios.servicio_auditoria import registrar_auditoria
                await registrar_auditoria(db, usuario_actual.id, "Analisis de Documento", f"Extraccion y evaluacion de riesgo para '{file.filename}'.")

                await db.flush()

                for i, d in enumerate(items_evaluados):
                    partida = modelos.Partida(
                        documento_id=nuevo_log.id,
                        descripcion=d["descripcion_producto"],
                        cantidad=d["cantidad"],
                        precio_unitario=d["precio_unitario"],
                        partida_sugerida=d["partida_sugerida"],
                        peso_neto_kg=d.get("peso_neto_kg"),
                        orden=i,
                    )
                    db.add(partida)

                await db.commit()
                await db.refresh(nuevo_log)
                doc_id = nuevo_log.id
            except Exception as error_db:
                print(f"Error guardando historial en BD: {str(error_db)}")

        ai_usage = datos_extraidos.get("_ai_metadata")
        if ai_usage:
            ai_usage["cache_hit"] = cache_hit

        return {
            "id": doc_id,
            "cache_hit": cache_hit,
            "remitente": {
                "nombre": datos_extraidos["emisor"].get("nombre"),
                "direccion": datos_extraidos["emisor"].get("direccion"),
                "documento": datos_extraidos["emisor"].get("tax_id"),
            },
            "destinatario": {
                "nombre": datos_extraidos["receptor"].get("nombre"),
                "direccion": datos_extraidos["receptor"].get("direccion"),
                "documento": datos_extraidos["receptor"].get("tax_id"),
            },
            "factura": {
                "numero": datos_extraidos["numero_factura"],
                "fecha": datos_extraidos["fecha_emision"],
                "moneda": datos_extraidos["moneda"],
                "incoterm": datos_extraidos.get("incoterm"),
                "pais_origen": datos_extraidos.get("pais_origen"),
            },
            "transporte": {
                "paisOrigen": datos_extraidos["emisor"].get("pais"),
                "metodo": datos_extraidos.get("transporte_metodo"),
                "courier": None,
                "tracking": None,
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
                "unidad_peso": datos_extraidos.get("pesos", {}).get("unidad"),
            },
            "riesgo": nivel_riesgo_general,
            "observaciones": eval_observaciones,
            "prevalidacion": evaluacion_dict,
            "partidaPrincipal": items_evaluados[0]["partida_sugerida"] if items_evaluados else None,
            "detalles": items_evaluados,
            "validacion_error": datos_extraidos.get("validacion_error", False),
            "mensaje_error": datos_extraidos.get("mensaje_error", ""),
            "ai_usage": ai_usage,
            "confianza": confianza_general,
            "cuadratura_items": verificar_cuadratura_items(datos_extraidos),
            "ocr_mock_mode": OCRService.is_mock_mode(),
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error inesperado al procesar el documento. Revisa que el archivo sea una factura válida e inténtalo de nuevo.",
        )

# Clasifica un producto en su partida arancelaria usando IA
@router.post("/clasificar-item")
async def clasificar_item_arancelario(
    payload: dict,
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    descripcion = payload.get("descripcion_producto")
    if not descripcion:
        raise HTTPException(status_code=400, detail="Falta la descripcion del producto.")

    res = await AITextService.classify_item(descripcion)
    if not res:
        raise HTTPException(
            status_code=500, detail="Error al invocar al motor de clasificacion IA."
        )
    return res
