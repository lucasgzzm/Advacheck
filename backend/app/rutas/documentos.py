import os
import uuid
import asyncio

from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from fastapi.responses import Response, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update, func, and_, delete
from sqlalchemy.orm import selectinload
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from .. import esquemas, modelos
from ..servicios.servicio_auditoria import registrar_auditoria
from ..servicios.servicio_email import enviar_correo_sincrono
from ..base_datos import get_db
from ..dependencias import obtener_usuario_actual, obtener_rol_usuario, obtener_documento_seguro
from ..configuracion import UPLOAD_DIR
from ..servicios.servicio_prevalidacion import ServicioPrevalidacionAduanera
from ..servicios.servicio_valoracion import MotorValoracionAduanera, SolicitudValoracion

router = APIRouter(prefix="/api/documentos", tags=["Documentos"])

@router.get("/limite")
async def obtener_limite_documentos(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    from ..limitadores import limitador_documentos
    from ..servicios.servicio_texto import AITextService

    doc = await limitador_documentos.contar_usados(db, usuario_actual.id)
    
    estado_gemini = await AITextService.obtener_estado()
    gemini_online = estado_gemini.get("online", True)
    gemini_motivo = estado_gemini.get("motivo")
    gemini_rate_limited = estado_gemini.get("rate_limited", False)
    gemini_retry_after = estado_gemini.get("retry_after")

    puede_subir = (doc["usados"] < doc["limite"]) and gemini_online
    
    if not gemini_online:
        motivo_bloqueo = gemini_motivo or "Servicio de IA no disponible"
    elif doc["usados"] >= doc["limite"]:
        motivo_bloqueo = "Limite de documentos por hora alcanzado"
    else:
        motivo_bloqueo = None

    return {
        "usados": doc["usados"],
        "limite": doc["limite"],
        "proxima_recarga": doc["proxima_recarga"],
        "puede_subir": puede_subir,
        "motivo_bloqueo": motivo_bloqueo,
        "gemini_online": gemini_online,
        "gemini_rate_limited": gemini_rate_limited,
        "gemini_retry_after": gemini_retry_after,
    }

@router.get("/historial", response_model=List[esquemas.DocumentoProcesadoResponse])
async def obtener_historial_escaneos(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    resultado = await db.execute(
        select(modelos.DocumentoProcesado)
        .options(selectinload(modelos.DocumentoProcesado.partidas))
        .filter(modelos.DocumentoProcesado.usuario_id == usuario_actual.id)
        .order_by(desc(modelos.DocumentoProcesado.fecha_analisis))
        .offset(skip)
        .limit(limit)
    )
    return resultado.scalars().all()

@router.get("/{documento_id:int}", response_model=esquemas.DocumentoProcesadoResponse)
async def obtener_documento(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)
    return documento

@router.put("/{documento_id:int}", response_model=esquemas.DocumentoProcesadoResponse)
async def actualizar_documento(
    documento_id: int,
    payload: esquemas.DocumentoProcesadoUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    if documento.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El documento esta bloqueado y no se puede modificar.",
        )

    if payload.proveedor is not None:
        documento.proveedor = payload.proveedor
    if payload.cliente is not None:
        documento.cliente = payload.cliente
    if payload.total_cif is not None:
        documento.total_cif = payload.total_cif
    if payload.riesgo is not None:
        documento.riesgo = payload.riesgo
    if payload.flete is not None:
        documento.flete = payload.flete
    if payload.seguro is not None:
        documento.seguro = payload.seguro
    if payload.otros is not None:
        documento.otros = payload.otros
    if payload.cliente_id is not None:
        documento.cliente_id = payload.cliente_id

    existing = await db.execute(
        select(modelos.Partida).filter(modelos.Partida.documento_id == documento_id)
    )
    for p in existing.scalars().all():
        await db.delete(p)

    if payload.partidas:
        for i, pdata in enumerate(payload.partidas):
            partida = modelos.Partida(
                documento_id=documento_id,
                descripcion=pdata.descripcion,
                cantidad=pdata.cantidad,
                precio_unitario=pdata.precio_unitario,
                partida_sugerida=pdata.partida_sugerida,
                partida_corregida=pdata.partida_corregida,
                orden=pdata.orden if pdata.orden is not None else i,
            )
            db.add(partida)

    if payload.fecha_emision is not None:
        documento.fecha_emision = payload.fecha_emision
    if payload.moneda is not None:
        documento.moneda = payload.moneda
    if payload.monto_subtotal is not None:
        documento.monto_subtotal = payload.monto_subtotal
    if payload.remitente_dir is not None:
        documento.remitente_dir = payload.remitente_dir
    if payload.remitente_doc is not None:
        documento.remitente_doc = payload.remitente_doc
    if payload.destinatario_dir is not None:
        documento.destinatario_dir = payload.destinatario_dir
    if payload.transporte_pais is not None:
        documento.transporte_pais = payload.transporte_pais
    if payload.transporte_metodo is not None:
        documento.transporte_metodo = payload.transporte_metodo
    if payload.peso_bruto is not None:
        documento.peso_bruto = payload.peso_bruto
    if payload.peso_neto is not None:
        documento.peso_neto = payload.peso_neto
    if payload.receptor_tax is not None:
        documento.receptor_tax = payload.receptor_tax
    if payload.numero_factura is not None:
        documento.numero_factura = payload.numero_factura
    if payload.incoterm is not None:
        documento.incoterm = payload.incoterm
    if payload.pais_origen is not None:
        documento.pais_origen = payload.pais_origen

    await registrar_auditoria(db, usuario_actual.id, "Actualizacion de Documento", f"Documento '{documento.nombre_archivo}' (ID: {documento.id}) actualizado.")

    factura_dict = {
        "numero_factura": documento.numero_factura,
        "monto_subtotal": documento.monto_subtotal,
        "monto_total_cif": documento.total_cif,
        "monto_flete": documento.flete or 0,
        "monto_seguro": documento.seguro or 0,
        "monto_otros_gastos": documento.otros or 0,
        "incoterm": documento.incoterm,
        "moneda": documento.moneda,
        "pais_origen": documento.pais_origen,
        "fecha_emision": documento.fecha_emision,
        "peso_bruto": documento.peso_bruto,
        "pesos": {
            "bruto": documento.peso_bruto or 0,
            "neto": documento.peso_neto or 0,
        },
        "emisor": {
            "nombre": documento.proveedor,
            "direccion": documento.remitente_dir,
            "tax_id": documento.remitente_doc,
            "pais": documento.transporte_pais,
        },
        "receptor": {
            "nombre": documento.cliente,
            "tax_id": documento.receptor_tax,
            "direccion": documento.destinatario_dir,
        },
        "detalles": [
            {
                "descripcion_producto": pdata.descripcion,
                "cantidad": pdata.cantidad,
                "precio_unitario": pdata.precio_unitario,
                "partida_arancelaria_sugerida": pdata.partida_corregida or pdata.partida_sugerida,
                "partida_arancelaria_corregida": pdata.partida_corregida,
                "orden": pdata.orden if pdata.orden is not None else i,
            }
            for i, pdata in enumerate(payload.partidas or [])
        ],
    }
    dos = documento.datos_originales or {}
    packing_list = dos.get("_packing_list") if isinstance(dos, dict) else None
    bl_data = dos.get("_bl_data") if isinstance(dos, dict) else None
    evaluacion = ServicioPrevalidacionAduanera.ejecutar(factura_dict, packing_list=packing_list, bl=bl_data)
    documento.prevalidacion_resultado = evaluacion

    await db.commit()
    await db.refresh(documento)
    return documento

@router.get("/{documento_id:int}/archivo")
async def servir_archivo_documento(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)
    if not documento.ruta_archivo:
        raise HTTPException(status_code=404, detail="Archivo no encontrado para este documento.")
    ruta_completa = os.path.join(UPLOAD_DIR, documento.ruta_archivo)
    if not os.path.exists(ruta_completa):
        raise HTTPException(status_code=404, detail="El archivo fisico ya no esta disponible en el servidor.")
    return FileResponse(
        ruta_completa,
        media_type="application/pdf",
        filename=documento.nombre_archivo,
    )

@router.put("/{documento_id:int}/aprobar")
async def aprobar_documento(
    documento_id: int,
    payload: esquemas.SolicitudAprobacion,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)
    rol = await obtener_rol_usuario(usuario_actual, db)
    es_admin = rol == "Administrador"

    if documento.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El documento esta bloqueado y no se puede aprobar.",
        )

    if payload.nuevo_total is not None:
        documento.total_cif = payload.nuevo_total

    if payload.solicitar_revision and not es_admin:
        documento.estado = "Pendiente Aprobacion Admin"
        mensaje = "Operacion enviada a revision superior (Riesgo Alto)."

        await registrar_auditoria(db, usuario_actual.id, "Solicitud de Revision", f"Documento '{documento.nombre_archivo}' (ID: {documento.id}) enviado a revision superior.")
    else:
        documento.estado = "Aprobado"
        mensaje = "Documento aprobado y sincronizado con exito."

        await registrar_auditoria(db, usuario_actual.id, "Aprobacion de Documento", f"Documento '{documento.nombre_archivo}' (ID: {documento.id}) aprobado. Total CIF: {documento.total_cif}")

    await db.commit()
    return {"mensaje": mensaje}

@router.put("/{documento_id:int}/prevalidar-aprobar")
async def prevalidar_y_aprobar_documento(
    documento_id: int,
    payload: esquemas.PrevalidarAprobarRequest,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    if not payload.confirmar:
        raise HTTPException(status_code=400, detail="Debes confirmar el bloqueo del documento.")

    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    if documento.bloqueado:
        raise HTTPException(
            status_code=409,
            detail=f"El documento ya esta bloqueado en estado '{documento.estado}'. "
                   "No se puede modificar.",
        )

    rol = await obtener_rol_usuario(usuario_actual, db)
    es_admin = rol == "Administrador"

    partidas = (
        await db.execute(
            select(modelos.Partida).filter(modelos.Partida.documento_id == documento_id)
        )
    ).scalars().all()

    factura_dict = {
        "numero_factura": documento.numero_factura,
        "monto_subtotal": documento.monto_subtotal,
        "monto_total_cif": documento.total_cif,
        "monto_flete": documento.flete or 0,
        "monto_seguro": documento.seguro or 0,
        "monto_otros_gastos": documento.otros or 0,
        "incoterm": documento.incoterm,
        "moneda": documento.moneda,
        "pais_origen": documento.pais_origen,
        "fecha_emision": documento.fecha_emision,
        "peso_bruto": documento.peso_bruto,
        "pesos": {
            "bruto": documento.peso_bruto or 0,
            "neto": documento.peso_neto or 0,
        },
        "emisor": {
            "nombre": documento.proveedor,
            "direccion": documento.remitente_dir,
            "tax_id": documento.remitente_doc,
            "pais": documento.transporte_pais,
        },
        "receptor": {
            "nombre": documento.cliente,
            "tax_id": documento.receptor_tax,
            "direccion": documento.destinatario_dir,
        },
        "detalles": [
            {
                "descripcion_producto": p.descripcion,
                "cantidad": p.cantidad,
                "precio_unitario": p.precio_unitario,
                "partida_arancelaria_sugerida": p.partida_corregida or p.partida_sugerida,
                "partida_arancelaria_corregida": p.partida_corregida,
            }
            for p in partidas
        ],
    }

    dos = documento.datos_originales or {}
    packing_list = dos.get("_packing_list") if isinstance(dos, dict) else None
    bl_data = dos.get("_bl_data") if isinstance(dos, dict) else None
    evaluacion = ServicioPrevalidacionAduanera.ejecutar(factura_dict, packing_list=packing_list, bl=bl_data)
    documento.prevalidacion_resultado = evaluacion

    documento.estado = "Aprobado"
    documento.bloqueado = True
    documento.fecha_bloqueo = datetime.now(timezone.utc).replace(tzinfo=None)
    documento.bloqueado_por_id = usuario_actual.id

    await registrar_auditoria(db, usuario_actual.id, "Prevalidacion y Bloqueo", (
            f"Documento '{documento.nombre_archivo}' (ID: {documento.id}) "
            f"cambiado a estado 'Aprobado' y bloqueado contra modificaciones."
        ))

    await db.commit()
    await db.refresh(documento)

    return {
        "mensaje": "Documento prevalidado, aprobado y bloqueado con exito.",
        "estado": documento.estado,
        "bloqueado": documento.bloqueado,
    }

@router.post("/{documento_id:int}/validar-permiso")
async def validar_permiso(
    documento_id: int,
    file: UploadFile = File(...),
    vb_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    resultado = await db.execute(
        select(modelos.VistoBueno).filter(
            modelos.VistoBueno.id == vb_id,
            modelos.VistoBueno.documento_id == documento_id,
        )
    )
    vb = resultado.scalars().first()
    if not vb:
        raise HTTPException(404, detail="Permiso no encontrado para este documento.")

    if file.content_type and file.content_type not in ["application/pdf", "application/octet-stream"]:
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF.")

    MAX_UPLOAD_SIZE = 10 * 1024 * 1024
    contenido = await file.read()
    if len(contenido) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo excede el limite de {MAX_UPLOAD_SIZE // (1024 * 1024)}MB.",
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "documento.pdf")[1] or ".pdf"
    nombre_archivo = f"permiso_{vb.id}_{uuid.uuid4()}{ext}"
    ruta_completa = os.path.join(UPLOAD_DIR, nombre_archivo)
    try:
        with open(ruta_completa, "wb") as f:
            f.write(contenido)
    except Exception:
        raise HTTPException(status_code=500, detail="Error al guardar el archivo en el servidor.")

    vb.archivo_nombre = nombre_archivo
    vb.estado = "aprobado"
    vb.fecha_gestion = datetime.now(timezone.utc).replace(tzinfo=None)

    partidas = (
        await db.execute(
            select(modelos.Partida).filter(modelos.Partida.documento_id == documento_id)
        )
    ).scalars().all()

    vbs_aprobados = (
        await db.execute(
            select(modelos.VistoBueno).filter(
                modelos.VistoBueno.documento_id == documento_id,
                modelos.VistoBueno.estado == "aprobado",
            )
        )
    ).scalars().all()

    factura_dict = {
        "numero_factura": documento.numero_factura,
        "monto_subtotal": documento.monto_subtotal,
        "monto_total_cif": documento.total_cif,
        "monto_flete": documento.flete or 0,
        "monto_seguro": documento.seguro or 0,
        "monto_otros_gastos": documento.otros or 0,
        "incoterm": documento.incoterm,
        "moneda": documento.moneda,
        "pais_origen": documento.pais_origen,
        "fecha_emision": documento.fecha_emision,
        "pesos": {
            "bruto": documento.peso_bruto or 0,
            "neto": documento.peso_neto or 0,
        },
        "emisor": {
            "nombre": documento.proveedor,
            "direccion": documento.remitente_dir,
            "tax_id": documento.remitente_doc,
            "pais": documento.transporte_pais,
        },
        "receptor": {
            "nombre": documento.cliente,
            "tax_id": documento.receptor_tax,
            "direccion": documento.destinatario_dir,
        },
        "detalles": [
            {
                "descripcion_producto": p.descripcion,
                "cantidad": p.cantidad,
                "precio_unitario": p.precio_unitario,
                "partida_arancelaria_sugerida": p.partida_corregida or p.partida_sugerida,
                "partida_arancelaria_corregida": p.partida_corregida,
            }
            for p in partidas
        ],
        "permisos_aprobados": [
            {"entidad": vb.entidad, "tipo_permiso": vb.tipo_permiso}
            for vb in vbs_aprobados
        ],
    }

    dos = documento.datos_originales or {}
    packing_list = dos.get("_packing_list") if isinstance(dos, dict) else None
    bl_data = dos.get("_bl_data") if isinstance(dos, dict) else None
    evaluacion = ServicioPrevalidacionAduanera.ejecutar(factura_dict, packing_list=packing_list, bl=bl_data)
    documento.prevalidacion_resultado = evaluacion

    await registrar_auditoria(
        db, usuario_actual.id, "Validacion de Permiso",
        f"Permiso '{vb.tipo_permiso}' de {vb.entidad} validado para documento '{documento.nombre_archivo}' (ID: {documento.id})."
    )
    await db.commit()

    return {
        "mensaje": f"Permiso '{vb.tipo_permiso}' de {vb.entidad} validado exitosamente.",
        "prevalidacion": evaluacion,
    }

@router.delete("/{documento_id:int}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_documento(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)
    rol = await obtener_rol_usuario(usuario_actual, db)
    es_admin = rol == "Administrador"

    if not es_admin and documento.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El documento esta bloqueado (Prevalidado / Aprobado) y no puede eliminarse.",
        )

    if documento.ruta_archivo:
        ruta_completa = os.path.join(UPLOAD_DIR, documento.ruta_archivo)
        if os.path.exists(ruta_completa):
            os.remove(ruta_completa)

    await db.execute(delete(modelos.Observacion).where(modelos.Observacion.documento_id == documento_id))
    await db.execute(delete(modelos.VistoBueno).where(modelos.VistoBueno.documento_id == documento_id))
    await registrar_auditoria(db, usuario_actual.id, "Eliminacion de Documento", f"Documento '{documento.nombre_archivo}' (ID: {documento.id}) eliminado por {usuario_actual.nombre}.")
    await db.delete(documento)
    await db.commit()
    return None

@router.get("/{documento_id:int}/observaciones")
async def obtener_observaciones(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    await obtener_documento_seguro(documento_id, usuario_actual, db)
    resultado = await db.execute(
        select(
            modelos.Observacion.id,
            modelos.Observacion.contenido,
            modelos.Observacion.tipo,
            modelos.Observacion.fecha_creacion,
            modelos.Observacion.usuario_id,
            modelos.Usuario.nombre.label("usuario_nombre"),
        )
        .join(modelos.Usuario, modelos.Observacion.usuario_id == modelos.Usuario.id)
        .filter(modelos.Observacion.documento_id == documento_id)
        .order_by(desc(modelos.Observacion.fecha_creacion))
    )
    filas = resultado.mappings().all()
    return [
        {
            "id": f["id"],
            "contenido": f["contenido"],
            "tipo": f["tipo"],
            "fecha_creacion": f["fecha_creacion"].isoformat(),
            "usuario_id": f["usuario_id"],
            "usuario_nombre": f["usuario_nombre"],
        }
        for f in filas
    ]

@router.post("/{documento_id:int}/observaciones", status_code=status.HTTP_201_CREATED)
async def crear_observacion(
    documento_id: int,
    obs: esquemas.ObservacionCreate,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    if documento.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El documento esta bloqueado y no se pueden agregar observaciones.",
        )

    nueva_obs = modelos.Observacion(
        contenido=obs.contenido,
        tipo=obs.tipo,
        documento_id=documento_id,
        usuario_id=usuario_actual.id,
    )
    db.add(nueva_obs)

    await registrar_auditoria(db, usuario_actual.id, "Observacion Agregada", f"Observacion anadida al documento '{documento.nombre_archivo}' (ID: {documento.id}): {obs.contenido[:100]}")
    await db.commit()
    await db.refresh(nueva_obs)

    return {"id": nueva_obs.id, "mensaje": "Observacion registrada correctamente."}

@router.post("/{documento_id:int}/solicitar-aclaracion")
async def solicitar_aclaracion_cliente(
    documento_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    mensaje = payload.get("mensaje", "").strip()
    if not mensaje:
        raise HTTPException(status_code=400, detail="El mensaje de aclaracion es obligatorio.")

    email = (payload.get("email") or "").strip()

    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    if documento.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El documento esta bloqueado y no se pueden solicitar aclaraciones.",
        )

    mensaje_html = mensaje.replace("\n", "<br>")
    asunto = f"Solicitud de Aclaracion - Documento #{documento.id}"
    nombre = documento.nombre_archivo or ""
    proveedor = documento.proveedor or "—"
    cliente = documento.cliente or "—"
    num_factura = documento.numero_factura or "—"
    total_cif = f"{documento.total_cif:,.2f}" if documento.total_cif else "—"
    moneda = documento.moneda or ""

    cuerpo_html = f"""<div style="font-family:Arial,Helvetica,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#7c3aed;padding:20px;border-radius:10px 10px 0 0">
<h1 style="color:#fff;margin:0;font-size:20px">Solicitud de Aclaracion</h1>
<p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Documento #{documento.id} &middot; {nombre}</p>
</div>
<div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px">
<p>Estimado/a importador,</p>
<p>Se ha solicitado una aclaracion para el siguiente documento:</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
<tr><td style="padding:6px 8px;color:#6b7280;width:130px">Documento:</td><td style="padding:6px 8px;font-weight:600">#{documento.id}</td></tr>
<tr><td style="padding:6px 8px;color:#6b7280">Archivo:</td><td style="padding:6px 8px">{nombre}</td></tr>
<tr><td style="padding:6px 8px;color:#6b7280">Proveedor:</td><td style="padding:6px 8px">{proveedor}</td></tr>
<tr><td style="padding:6px 8px;color:#6b7280">Importador:</td><td style="padding:6px 8px">{cliente}</td></tr>
<tr><td style="padding:6px 8px;color:#6b7280">Factura N&deg;:</td><td style="padding:6px 8px">{num_factura}</td></tr>
<tr><td style="padding:6px 8px;color:#6b7280">Total CIF:</td><td style="padding:6px 8px">{total_cif} {moneda}</td></tr>
</table>
<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:16px 0">
<p style="margin:0 0 4px;font-weight:700;font-size:13px;color:#92400e">Mensaje del agente aduanero:</p>
<p style="margin:0;font-size:14px;color:#78350f">{mensaje_html}</p>
</div>
<p style="font-size:14px;color:#6b7280">El documento ha quedado en estado <strong>"En Espera"</strong> hasta que se reciba la informacion solicitada. Por favor, revise el mensaje y proporcione la informacion requerida a la brevedad.</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
<p style="font-size:12px;color:#9ca3af;text-align:center">WebCheck &mdash; Sistema de Prevalidacion Aduanera</p>
</div>
</div>"""

    correo_enviado = False
    if email:
        resultado = await asyncio.to_thread(enviar_correo_sincrono, email, asunto, cuerpo_html)
        correo_enviado = resultado.get("exito", False)

    contenido_obs = f"[ACLARACION ENVIADA A {email}] {mensaje}" if email else f"[ACLARACION SIN EMAIL] {mensaje}"
    observacion = modelos.Observacion(
        contenido=contenido_obs,
        tipo="correccion",
        documento_id=documento_id,
        usuario_id=usuario_actual.id,
    )
    db.add(observacion)

    documento.estado = "En Espera"

    await registrar_auditoria(
        db, usuario_actual.id, "Solicitud de Aclaracion",
        f"Solicitud de aclaracion {'enviada a ' + email if email else 'sin email'} para '{documento.nombre_archivo}' (ID: {documento.id}): {mensaje[:200]}"
    )

    await db.commit()

    msg_resp = (
        "Solicitud de aclaracion enviada. El documento queda en estado 'En Espera'."
        if correo_enviado
        else "Solicitud registrada, pero no se pudo enviar el correo. Verifique la configuracion SMTP."
    )

    return {
        "mensaje": msg_resp,
        "estado": "En Espera",
        "correo_enviado": correo_enviado,
    }

@router.get("/alertas")
async def obtener_alertas(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func, and_

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    alertas = []

    vbs = await db.execute(
        select(modelos.VistoBueno)
        .join(modelos.DocumentoProcesado)
        .filter(
            modelos.DocumentoProcesado.usuario_id == usuario_actual.id,
            modelos.VistoBueno.estado.in_(["pendiente"]),
        )
    )
    for vb in vbs.scalars().all():
        if vb.fecha_gestion and (ahora - vb.fecha_gestion).days >= 7:
            alertas.append({
                "tipo": "vb_pendiente",
                "severidad": "media",
                "documento_id": vb.documento_id,
                "nombre_archivo": vb.documento_rel.nombre_archivo if vb.documento_rel else "",
                "estado_actual": vb.entidad,
                "dias_detenido": (ahora - vb.fecha_gestion).days,
                "mensaje": f"V°B° de {vb.entidad} pendiente desde hace {(ahora - vb.fecha_gestion).days} dias",
            })

    alertas.sort(key=lambda a: {"alta": 0, "media": 1, "baja": 2}.get(a["severidad"], 3))

    return alertas[:20]

@router.get("/metrics")
async def obtener_metricas_agente(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    base = select(modelos.DocumentoProcesado).filter(
        modelos.DocumentoProcesado.usuario_id == usuario_actual.id
    )

    total = await db.execute(select(func.count()).select_from(base.subquery()))
    total_docs = total.scalar() or 0

    pend_q = await db.execute(
        select(func.count())
        .select_from(modelos.DocumentoProcesado)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == usuario_actual.id,
            modelos.DocumentoProcesado.estado == "En Revisión",
            modelos.DocumentoProcesado.bloqueado == False,
        ))
    )
    pendientes = pend_q.scalar() or 0

    inicio_mes = datetime.now(timezone.utc).replace(tzinfo=None).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    aprob_q = await db.execute(
        select(func.count())
        .select_from(modelos.DocumentoProcesado)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == usuario_actual.id,
            modelos.DocumentoProcesado.estado == "Aprobado",
            modelos.DocumentoProcesado.fecha_analisis >= inicio_mes,
        ))
    )
    aprobados_mes = aprob_q.scalar() or 0

    alto_q = await db.execute(
        select(func.count())
        .select_from(modelos.DocumentoProcesado)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == usuario_actual.id,
            modelos.DocumentoProcesado.riesgo == "alto",
        ))
    )
    total_alto = alto_q.scalar() or 0
    tasa_alto = round((total_alto / total_docs * 100), 1) if total_docs > 0 else 0

    pend_admin_q = await db.execute(
        select(func.count())
        .select_from(modelos.DocumentoProcesado)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == usuario_actual.id,
            modelos.DocumentoProcesado.estado == "Pendiente Aprobacion Admin",
        ))
    )
    pend_admin = pend_admin_q.scalar() or 0

    return {
        "total_documentos": total_docs,
        "pendientes": pendientes,
        "aprobados_este_mes": aprobados_mes,
        "tasa_riesgo_alto": tasa_alto,
        "pendientes_admin": pend_admin,
    }

@router.get("/pendientes")
async def obtener_pendientes_agente(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    uid = usuario_actual.id

    sin_clasificar = await db.execute(
        select(modelos.DocumentoProcesado.id, modelos.DocumentoProcesado.nombre_archivo)
        .join(modelos.Partida, modelos.Partida.documento_id == modelos.DocumentoProcesado.id)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == uid,
            modelos.DocumentoProcesado.bloqueado == False,
            modelos.Partida.partida_corregida == None,
        ))
        .distinct()
    )
    docs_sin_clasificar = [
        {"id": r.id, "nombre_archivo": r.nombre_archivo}
        for r in sin_clasificar.all()
    ]

    vbb_pendientes = await db.execute(
        select(modelos.DocumentoProcesado.id, modelos.DocumentoProcesado.nombre_archivo)
        .join(modelos.VistoBueno, modelos.VistoBueno.documento_id == modelos.DocumentoProcesado.id)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == uid,
            modelos.VistoBueno.estado == "pendiente",
        ))
        .distinct()
    )
    docs_vbb_pendientes = [
        {"id": r.id, "nombre_archivo": r.nombre_archivo}
        for r in vbb_pendientes.all()
    ]

    return {
        "sin_clasificar": docs_sin_clasificar,
        "vbb_pendientes": docs_vbb_pendientes,
    }

@router.get("/vencimientos")
async def obtener_vencimientos(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    uid = usuario_actual.id
    hoy = datetime.now(timezone.utc).replace(tzinfo=None)

    pend_admin = await db.execute(
        select(
            modelos.DocumentoProcesado.id,
            modelos.DocumentoProcesado.nombre_archivo,
            modelos.DocumentoProcesado.fecha_analisis,
        )
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == uid,
            modelos.DocumentoProcesado.estado == "Pendiente Aprobacion Admin",
        ))
    )
    docs_pend_admin = []
    for d in pend_admin.all():
        dias_espera = (hoy - d.fecha_analisis).days if d.fecha_analisis else 0
        docs_pend_admin.append({
            "id": d.id,
            "nombre_archivo": d.nombre_archivo,
            "dias_espera": dias_espera,
        })

    return {
        "pendientes_admin": docs_pend_admin,
    }

@router.get("/{documento_id:int}/landed-cost")
async def obtener_landed_cost(
    documento_id: int,
    pais_destino: str = "CL",
    aplica_tlc: bool = False,
    dta_tasa: float = 0.0,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    partidas = await db.execute(
        select(modelos.Partida).filter(modelos.Partida.documento_id == documento_id)
    )
    items = partidas.scalars().all()

    fob = sum(p.cantidad * p.precio_unitario for p in items if p.cantidad and p.precio_unitario)
    flete = getattr(documento, "flete", None) or 0
    seguro = getattr(documento, "seguro", None) or 0
    otros = getattr(documento, "otros", None) or 0
    valor_cif = fob + float(flete) + float(seguro) + float(otros)

    tasa_advalorem = 0.0 if aplica_tlc else 6.0
    impuesto_advalorem = valor_cif * (tasa_advalorem / 100)
    tasa_iva = {"CL": 19, "MX": 16, "ES": 21}.get(pais_destino, 19)
    dta = (valor_cif * (dta_tasa / 100)) if pais_destino == "MX" else 0
    base_iva = valor_cif + impuesto_advalorem + dta
    impuesto_iva = base_iva * (tasa_iva / 100)
    total_tributos = impuesto_advalorem + dta + impuesto_iva
    total_landed = valor_cif + total_tributos

    return {
        "documento_id": documento_id,
        "valor_fob": round(fob, 2),
        "flete": float(flete),
        "seguro": float(seguro),
        "otros": float(otros),
        "valor_cif": round(valor_cif, 2),
        "tasa_advalorem": tasa_advalorem,
        "impuesto_advalorem": round(impuesto_advalorem, 2),
        "tasa_iva": tasa_iva,
        "dta": round(dta, 2),
        "base_iva": round(base_iva, 2),
        "impuesto_iva": round(impuesto_iva, 2),
        "total_tributos": round(total_tributos, 2),
        "total_landed_cost": round(total_landed, 2),
    }

@router.post("/valorar")
async def valorar_landed_cost(
    solicitud: SolicitudValoracion,
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    motor = MotorValoracionAduanera(solicitud)
    return motor.calcular()
