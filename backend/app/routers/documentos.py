import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update, func, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from .. import esquemas, modelos
from ..services.servicio_auditoria import registrar_auditoria
from ..base_datos import get_db
from ..dependencias import obtener_usuario_actual, obtener_rol_usuario, obtener_documento_seguro
from ..services.servicio_archivo_intercambio import generar_xml_intercambio, generar_json_intercambio
from ..services.servicio_correo import enviar_correo_aclaracion, enviar_correo_con_adjunto
from ..services.servicio_informe import generar_pdf_informe
from ..configuracion import UPLOAD_DIR

router = APIRouter(prefix="/api/documentos", tags=["Documentos"])

@router.get("/limite")
async def obtener_limite_documentos(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Devuelve cuántos documentos ha subido el usuario en la última hora y cuál es su límite.
    También retorna proxima_recarga: el momento exacto (ISO 8601 UTC) en que el slot más antiguo
    se libera (es decir, cuando el documento más antiguo de la ventana cumple 60 minutos).
    """
    from datetime import datetime, timedelta
    from sqlalchemy import func, and_, select, asc
    
    limite = 20
    ahora = datetime.utcnow()
    hora_hace_60_min = ahora - timedelta(hours=1)
    
    resultado = await db.execute(
        select(func.count())
        .select_from(modelos.DocumentoProcesado)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == usuario_actual.id,
            modelos.DocumentoProcesado.fecha_analisis >= hora_hace_60_min
        ))
    )
    usados = resultado.scalar() or 0

    # Obtener el más antiguo en la ventana para calcular cuándo se libera el primer slot
    doc_mas_antiguo = await db.execute(
        select(modelos.DocumentoProcesado.fecha_analisis)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == usuario_actual.id,
            modelos.DocumentoProcesado.fecha_analisis >= hora_hace_60_min
        ))
        .order_by(asc(modelos.DocumentoProcesado.fecha_analisis))
        .limit(1)
    )
    fecha_mas_antigua = doc_mas_antiguo.scalar()
    proxima_recarga = None
    if fecha_mas_antigua:
        proxima_recarga = (fecha_mas_antigua + timedelta(hours=1)).isoformat() + "Z"

    return {
        "usados": usados,
        "limite": limite,
        "proxima_recarga": proxima_recarga
    }

@router.get("/historial", response_model=List[esquemas.DocumentoProcesadoResponse])
async def obtener_historial_escaneos(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Todos los documentos que ha escaneado el agente, del mas reciente al mas antiguo."""
    resultado = await db.execute(
        select(modelos.DocumentoProcesado)
        .options(selectinload(modelos.DocumentoProcesado.partidas))
        .filter(modelos.DocumentoProcesado.usuario_id == usuario_actual.id)
        .order_by(desc(modelos.DocumentoProcesado.fecha_analisis))
    )
    return resultado.scalars().all()


@router.get("/{documento_id:int}", response_model=esquemas.DocumentoProcesadoResponse)
async def obtener_documento(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Devuelve un documento por su ID. Verifica que el usuario tenga acceso a el."""
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)
    return documento


@router.put("/{documento_id:int}", response_model=esquemas.DocumentoProcesadoResponse)
async def actualizar_documento(
    documento_id: int,
    payload: esquemas.DocumentoProcesadoUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Actualiza los datos de un documento y reemplaza sus partidas.
    Si el documento esta bloqueado, no se puede modificar.
    """
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
    from datetime import datetime
    now = datetime.utcnow()

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

    # Guarda los campos extra de la factura si vienen en el payload
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
    await db.commit()
    await db.refresh(documento)
    return documento


@router.get("/{documento_id:int}/archivo")
async def servir_archivo_documento(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Descarga el PDF original que se subio para este documento."""
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
    """Aprueba un documento directamente, o si es de riesgo alto, lo manda a revision del admin."""
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

        admins = await db.execute(
            select(modelos.Usuario)
            .join(modelos.Rol)
            .filter(modelos.Rol.nombre == "Administrador")
        )
        for admin in admins.scalars().all():
            notif = modelos.Notificacion(
                titulo="Solicitud de Revision",
                mensaje=f"{usuario_actual.nombre} solicita revision del documento '{documento.nombre_archivo}' (Riesgo Alto).",
                tipo="alerta",
                documento_id=documento.id,
                usuario_destino_id=admin.id,
                usuario_origen_id=usuario_actual.id,
            )
            db.add(notif)
    else:
        documento.estado = "Aprobado"
        mensaje = "Documento aprobado y sincronizado con exito."

        await registrar_auditoria(db, usuario_actual.id, "Aprobacion de Documento", f"Documento '{documento.nombre_archivo}' (ID: {documento.id}) aprobado. Total CIF: {documento.total_cif}")

        if documento.usuario_id and documento.usuario_id != usuario_actual.id:
            notif = modelos.Notificacion(
                titulo="Documento Aprobado",
                mensaje=f"Tu documento '{documento.nombre_archivo}' ha sido aprobado por {usuario_actual.nombre}.",
                tipo="aprobacion",
                documento_id=documento.id,
                usuario_destino_id=documento.usuario_id,
                usuario_origen_id=usuario_actual.id,
            )
            db.add(notif)

    await db.commit()
    return {"mensaje": mensaje}


@router.put("/{documento_id:int}/prevalidar-aprobar")
async def prevalidar_y_aprobar_documento(
    documento_id: int,
    payload: esquemas.PrevalidarAprobarRequest,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Aprueba y bloquea el documento definitivamente. Una vez bloqueado, no se puede editar ni eliminar."""
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

    documento.estado = "Aprobado"
    documento.bloqueado = True
    documento.fecha_bloqueo = datetime.utcnow()
    documento.bloqueado_por_id = usuario_actual.id

    await registrar_auditoria(db, usuario_actual.id, "Prevalidacion y Bloqueo", (
            f"Documento '{documento.nombre_archivo}' (ID: {documento.id}) "
            f"cambiado a estado 'Aprobado' y bloqueado contra modificaciones."
        ))

    if documento.usuario_id and documento.usuario_id != usuario_actual.id:
        notif = modelos.Notificacion(
            titulo="Documento Prevalidado y Bloqueado",
            mensaje=(
                f"El documento '{documento.nombre_archivo}' ha sido aprobado y "
                f"bloqueado por {usuario_actual.nombre}. Ya esta listo para exportacion."
            ),
            tipo="aprobacion",
            documento_id=documento.id,
            usuario_destino_id=documento.usuario_id,
            usuario_origen_id=usuario_actual.id,
        )
        db.add(notif)

    await db.commit()
    await db.refresh(documento)

    return {
        "mensaje": "Documento prevalidado, aprobado y bloqueado con exito.",
        "estado": documento.estado,
        "bloqueado": documento.bloqueado,
    }


@router.put("/{documento_id:int}/despachante")
async def asignar_despachante(
    documento_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Asigna un agente de aduana (despachante) a un documento."""
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)
    despachante_id = payload.get("despachante_id")
    if despachante_id is not None:
        desp = await db.get(modelos.Despachante, despachante_id)
        if not desp or not desp.activo:
            raise HTTPException(404, "Despachante no encontrado")
    documento.despachante_id = despachante_id
    await db.commit()
    return {"mensaje": "Despachante asignado", "despachante_id": despachante_id}


@router.put("/{documento_id:int}/exportar/xml")
async def exportar_xml_intercambio(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Genera un archivo XML con los datos del documento, observaciones y V°B° para intercambiar con otros sistemas."""
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    observaciones = await db.execute(
        select(modelos.Observacion).filter(
            modelos.Observacion.documento_id == documento_id
        )
    )
    obs_list = observaciones.scalars().all()

    vistos_buenos = await db.execute(
        select(modelos.VistoBueno).filter(
            modelos.VistoBueno.documento_id == documento_id
        )
    )
    vbb_list = vistos_buenos.scalars().all()

    doc_dict = {
        "id": documento.id,
        "nombre_archivo": documento.nombre_archivo,
        "fecha_analisis": documento.fecha_analisis.isoformat() if documento.fecha_analisis else None,
        "proveedor": documento.proveedor,
        "cliente": documento.cliente,
        "total_cif": documento.total_cif,
        "riesgo": documento.riesgo,
        "estado": documento.estado,
    }

    detalles = [
        {
            "descripcion": o.contenido,
            "cantidad": 0,
            "precio_unitario": 0,
            "partida_sugerida": "",
            "partida_corregida": "",
        }
        for o in obs_list
    ]

    vbb = [
        {
            "entidad": vb.entidad,
            "tipo_permiso": vb.tipo_permiso,
            "estado": vb.estado,
            "observaciones": vb.observaciones or "",
        }
        for vb in vbb_list
    ]

    xml_content = generar_xml_intercambio(
        doc_dict, detalles, vbb, usuario_actual.nombre
    )

    await registrar_auditoria(db, usuario_actual.id, "Exportacion de Archivo de Intercambio (XML)", (
            f"XML de intercambio generado para '{documento.nombre_archivo}' "
            f"(ID: {documento.id})."
        ))
    await db.commit()

    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={
            "Content-Disposition": f'attachment; filename="intercambio_{documento.id}.xml"'
        },
    )


@router.put("/{documento_id:int}/exportar/json")
async def exportar_json_intercambio(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Genera un JSON con los datos del documento y sus V°B° para exportar a otros sistemas."""
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    vistos_buenos = await db.execute(
        select(modelos.VistoBueno).filter(
            modelos.VistoBueno.documento_id == documento_id
        )
    )
    vbb_list = vistos_buenos.scalars().all()

    doc_dict = {
        "id": documento.id,
        "nombre_archivo": documento.nombre_archivo,
        "fecha_analisis": documento.fecha_analisis.isoformat() if documento.fecha_analisis else None,
        "proveedor": documento.proveedor,
        "cliente": documento.cliente,
        "total_cif": documento.total_cif,
        "riesgo": documento.riesgo,
        "estado": documento.estado,
    }

    vbb = [
        {
            "entidad": vb.entidad,
            "tipo_permiso": vb.tipo_permiso,
            "estado": vb.estado,
            "observaciones": vb.observaciones or "",
        }
        for vb in vbb_list
    ]

    json_content = generar_json_intercambio(doc_dict, [], vbb, usuario_actual.nombre)

    await registrar_auditoria(db, usuario_actual.id, "Exportacion de Archivo de Intercambio (JSON)", (
            f"JSON de intercambio generado para '{documento.nombre_archivo}' "
            f"(ID: {documento.id})."
        ))
    await db.commit()

    return json_content


@router.delete("/{documento_id:int}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_documento(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Elimina un documento y su archivo PDF del servidor.
    Si esta bloqueado, solo el admin puede eliminarlo.
    """
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
    """Devuelve todas las observaciones de un documento, con el nombre del usuario que las escribio."""
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
    """Agrega una observacion a un documento. No permite agregar si el documento esta bloqueado."""
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


@router.get("/notificaciones/mis")
async def obtener_mis_notificaciones(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Las notificaciones del usuario logueado (max 30, mas recientes primero)."""
    resultado = await db.execute(
        select(modelos.Notificacion)
        .filter(modelos.Notificacion.usuario_destino_id == usuario_actual.id)
        .order_by(desc(modelos.Notificacion.fecha_creacion))
        .limit(30)
    )
    notificaciones = resultado.scalars().all()

    return [
        {
            "id": n.id,
            "titulo": n.titulo,
            "mensaje": n.mensaje,
            "tipo": n.tipo,
            "leida": n.leida,
            "fecha_creacion": n.fecha_creacion.isoformat(),
            "documento_id": n.documento_id,
        }
        for n in notificaciones
    ]


@router.patch("/notificaciones/{notificacion_id}/leer")
async def marcar_notificacion_leida(
    notificacion_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Marca una notificacion como leida."""
    resultado = await db.execute(
        select(modelos.Notificacion)
        .filter(modelos.Notificacion.id == notificacion_id)
        .filter(modelos.Notificacion.usuario_destino_id == usuario_actual.id)
    )
    notif = resultado.scalars().first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificacion no encontrada.")

    notif.leida = True
    await db.commit()
    return {"mensaje": "Notificacion marcada como leida."}


@router.patch("/notificaciones/leer-todas")
async def marcar_todas_leidas(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Marca todas las notificaciones del usuario como leidas de una sola vez."""
    await db.execute(
        update(modelos.Notificacion)
        .where(modelos.Notificacion.usuario_destino_id == usuario_actual.id)
        .where(modelos.Notificacion.leida == False)
        .values(leida=True)
    )
    await db.commit()
    return {"mensaje": "Todas las notificaciones marcadas como leidas."}


@router.post("/{documento_id:int}/solicitar-aclaracion")
async def solicitar_aclaracion_cliente(
    documento_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Pide una aclaracion al cliente sobre un documento. Deja el documento en estado 'En Espera'."""
    mensaje = payload.get("mensaje", "").strip()
    if not mensaje:
        raise HTTPException(status_code=400, detail="El mensaje de aclaracion es obligatorio.")

    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    if documento.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El documento esta bloqueado y no se pueden solicitar aclaraciones.",
        )

    observacion = modelos.Observacion(
        contenido=f"[ACLARACION AL CLIENTE] {mensaje}",
        tipo="correccion",
        documento_id=documento_id,
        usuario_id=usuario_actual.id,
    )
    db.add(observacion)

    documento.estado = "En Espera"

    await registrar_auditoria(db, usuario_actual.id, "Solicitud de Aclaracion", f"Solicitud de aclaracion enviada para '{documento.nombre_archivo}' (ID: {documento.id}): {mensaje[:200]}")

    await db.commit()

    # Notificamos al agente que creo el documento (si no es el mismo que envia)
    if documento.usuario_id and documento.usuario_id != usuario_actual.id:
        notif_agente = modelos.Notificacion(
            titulo="Aclaracion Solicitada",
            mensaje=f"Se solicito aclaracion para '{documento.nombre_archivo}'. El documento quedo en estado 'En Espera'.",
            tipo="info",
            documento_id=documento.id,
            usuario_destino_id=documento.usuario_id,
            usuario_origen_id=usuario_actual.id,
        )
        db.add(notif_agente)

    # Si quien envia NO es administrador, notificamos a todos los admins
    rol = await obtener_rol_usuario(usuario_actual, db)
    if rol != "Administrador":
        admins = await db.execute(
            select(modelos.Usuario)
            .join(modelos.Rol)
            .filter(modelos.Rol.nombre == "Administrador")
        )
        for admin in admins.scalars().all():
            notif_admin = modelos.Notificacion(
                titulo="Aclaracion Solicitada",
                mensaje=f"{usuario_actual.nombre} solicito aclaracion para '{documento.nombre_archivo}'. Quedo en 'En Espera'.",
                tipo="info",
                documento_id=documento.id,
                usuario_destino_id=admin.id,
                usuario_origen_id=usuario_actual.id,
            )
            db.add(notif_admin)

    await db.commit()

    # Intentamos enviar un correo al importador
    # Primero usamos el email que vino del frontend (el agente lo confirmo),
    # si no hay, usamos el email del cliente registrado en el sistema.
    email_enviado = False
    email_destino = payload.get("email") or (documento.cliente_rel.email if documento.cliente_rel else None)
    if email_destino:
        email_enviado = enviar_correo_aclaracion(
            destinatario=email_destino,
            nombre_archivo=documento.nombre_archivo,
            mensaje=mensaje,
        )

    return {
        "mensaje": "Solicitud de aclaracion enviada. El documento queda en estado 'En Espera'.",
        "estado": "En Espera",
        "email_enviado": email_enviado,
        "email_destino": email_destino,
    }


@router.get("/alertas")
async def obtener_alertas(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Genera alertas de V°B° pendientes desde hace mas de 7 dias."""
    from datetime import datetime, timedelta
    from sqlalchemy import func, and_

    ahora = datetime.utcnow()
    alertas = []

    # V°B° pendientes sin gestion por mas de 7 dias
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
    """Indicadores del agente: total documentos, pendientes, aprobados del mes, tasa de riesgo alto."""
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

    inicio_mes = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
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
    """Tareas pendientes: documentos sin clasificar, sin despachante, o con V°B° pendientes."""
    uid = usuario_actual.id

    # 1. Documentos con partidas sin clasificar (partida_corregida vacia)
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

    # 2. Documentos sin despachante asignado
    sin_despachante = await db.execute(
        select(modelos.DocumentoProcesado.id, modelos.DocumentoProcesado.nombre_archivo)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == uid,
            modelos.DocumentoProcesado.despachante_id == None,
            modelos.DocumentoProcesado.bloqueado == False,
            modelos.DocumentoProcesado.estado != "Aprobado",
        ))
    )
    docs_sin_despachante = [
        {"id": r.id, "nombre_archivo": r.nombre_archivo}
        for r in sin_despachante.all()
    ]

    # 3. Documentos con V°B° pendientes
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
        "sin_despachante": docs_sin_despachante,
        "vbb_pendientes": docs_vbb_pendientes,
    }


@router.get("/vencimientos")
async def obtener_vencimientos(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Alertas de vencimientos: pendientes de admin (>3 dias)."""
    uid = usuario_actual.id
    hoy = datetime.utcnow()

    # Documentos pendientes de aprobacion admin por mas de 3 dias
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


@router.post("/{documento_id:int}/enviar-informe")
async def enviar_informe_pdf(
    documento_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Genera un PDF con el informe del documento y lo envia por correo electronico.

    Recibe el email del destinatario en el payload. Genera el PDF con todos los
    datos del documento, items, V°B° y observaciones, y lo adjunta al correo.
    """
    email = (payload.get("email") or "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="El email del destinatario es obligatorio.")

    pais_destino = (payload.get("pais_destino") or "CL").upper()
    aplica_tlc = bool(payload.get("aplica_tlc", False))
    dta_tasa = float(payload.get("dta_tasa", 0.0))

    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    # Obtiene las partidas del documento
    partidas_q = await db.execute(
        select(modelos.Partida).filter(modelos.Partida.documento_id == documento_id)
    )
    partidas = [
        {
            "descripcion": p.descripcion,
            "cantidad": p.cantidad,
            "precio_unitario": p.precio_unitario,
            "partida_sugerida": p.partida_sugerida,
            "partida_corregida": p.partida_corregida,
        }
        for p in partidas_q.scalars().all()
    ]

    # Obtiene los V°B° del documento
    vbb_q = await db.execute(
        select(modelos.VistoBueno).filter(
            modelos.VistoBueno.documento_id == documento_id
        )
    )
    vistos_buenos = [
        {
            "entidad": vb.entidad,
            "tipo_permiso": vb.tipo_permiso,
            "estado": vb.estado,
            "observaciones": vb.observaciones or "",
        }
        for vb in vbb_q.scalars().all()
    ]

    # Obtiene las observaciones del documento
    obs_q = await db.execute(
        select(
            modelos.Observacion.contenido,
            modelos.Observacion.tipo,
            modelos.Observacion.fecha_creacion,
            modelos.Usuario.nombre.label("usuario_nombre"),
        )
        .join(modelos.Usuario, modelos.Observacion.usuario_id == modelos.Usuario.id)
        .filter(modelos.Observacion.documento_id == documento_id)
        .order_by(desc(modelos.Observacion.fecha_creacion))
    )
    observaciones = [
        {
            "contenido": r.contenido,
            "tipo": r.tipo,
            "fecha_creacion": r.fecha_creacion.isoformat() if r.fecha_creacion else None,
            "usuario_nombre": r.usuario_nombre,
        }
        for r in obs_q.mappings().all()
    ]

    # Arma el dict del documento con todos los campos para el PDF
    historia_dict = {
        "nombre_archivo": documento.nombre_archivo,
        "numero_factura": documento.numero_factura,
        "fecha_emision": documento.fecha_emision,
        "moneda": documento.moneda,
        "incoterm": documento.incoterm,
        "pais_origen": documento.pais_origen,
        "total_cif": documento.total_cif,
        "monto_subtotal": documento.monto_subtotal,
        "flete": documento.flete,
        "seguro": documento.seguro,
        "otros": documento.otros,
        "proveedor": documento.proveedor,
        "cliente": documento.cliente,
        "remitente_dir": documento.remitente_dir,
        "destinatario_dir": documento.destinatario_dir,
        "transporte_pais": documento.transporte_pais,
        "transporte_metodo": documento.transporte_metodo,
        "peso_bruto": documento.peso_bruto,
        "peso_neto": documento.peso_neto,
        "receptor_tax": documento.receptor_tax,
        "riesgo": documento.riesgo,
        "estado": documento.estado,
    }

    doc_extra = {
        "emisor_nombre": documento.proveedor,
        "emisor_tax_id": documento.remitente_doc,
        "remitente_dir": documento.remitente_dir,
        "destinatario_dir": documento.destinatario_dir,
        "transporte_pais": documento.transporte_pais,
        "transporte_metodo": documento.transporte_metodo,
    }

    try:
        pdf_bytes = generar_pdf_informe(
            historia=historia_dict,
            doc_extra=doc_extra,
            partidas=partidas,
            vistos_buenos=vistos_buenos,
            observaciones=observaciones,
            usuario_nombre=usuario_actual.nombre,
            pais_destino=pais_destino,
            aplica_tlc=aplica_tlc,
            dta_tasa=dta_tasa,
            prevalidacion=documento.prevalidacion_resultado,
        )
    except Exception as exc:
        logger.error("Error generando PDF para documento %d: %s", documento_id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar el PDF: {str(exc)}",
        )

    asunto = f"Informe de Prevalidación - {documento.nombre_archivo}"
    cuerpo = f"""\
<html>
<body style="font-family:sans-serif;padding:20px;">
    <h2>Informe de Prevalidación Aduanera</h2>
    <p><strong>Documento:</strong> {documento.nombre_archivo}</p>
    <p><strong>Riesgo:</strong> {documento.riesgo or 'N/A'}</p>
    <p><strong>Estado:</strong> {documento.estado or 'N/A'}</p>
    <hr>
    <p>Se adjunta el informe completo en formato PDF con los datos del documento,
    valores, logística, items, V°B° y observaciones.</p>
    <p style="color:#666;font-size:0.85em;">
        Generado por {usuario_actual.nombre} a través de Advacheck.
    </p>
</body>
</html>"""

    nombre_pdf = f"informe_{documento.id}.pdf"
    email_enviado = enviar_correo_con_adjunto(
        destinatario=email,
        asunto=asunto,
        cuerpo_html=cuerpo,
        adjunto_nombre=nombre_pdf,
        adjunto_bytes=pdf_bytes,
    )

    if not email_enviado:
        logger.warning("No se pudo enviar el correo con el informe a %s", email)

    await registrar_auditoria(
        db, usuario_actual.id, "Envio de Informe PDF",
        f"Informe PDF del documento '{documento.nombre_archivo}' (ID: {documento.id}) enviado a {email}.",
    )

    # Notifica al usuario actual que el informe fue enviado
    notif = modelos.Notificacion(
        titulo="Informe Enviado",
        mensaje=f"Informe PDF de '{documento.nombre_archivo}' enviado a {email}.",
        tipo="info",
        documento_id=documento.id,
        usuario_destino_id=usuario_actual.id,
        usuario_origen_id=usuario_actual.id,
    )
    db.add(notif)

    # Si el documento pertenece a otro usuario, tambien lo notificamos
    if documento.usuario_id and documento.usuario_id != usuario_actual.id:
        notif_dueno = modelos.Notificacion(
            titulo="Informe Enviado",
            mensaje=f"Se envió el informe PDF de '{documento.nombre_archivo}' a {email} por {usuario_actual.nombre}.",
            tipo="info",
            documento_id=documento.id,
            usuario_destino_id=documento.usuario_id,
            usuario_origen_id=usuario_actual.id,
        )
        db.add(notif_dueno)

    await db.commit()

    return {
        "mensaje": "Informe enviado correctamente." if email_enviado else "No se pudo enviar el correo.",
        "email_enviado": email_enviado,
        "email_destino": email,
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
    """Calcula el costo total nacionalizado (landed cost) de un documento.
    Considera FOB, flete, seguro, otros, arancel ad-valorem, DTA (solo MX) e IVA.
    """
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



