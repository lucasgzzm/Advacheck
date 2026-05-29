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
from ..config import UPLOAD_DIR

router = APIRouter(prefix="/api/documentos", tags=["Documentos"])




@router.get("/historial", response_model=List[esquemas.DocumentoProcesadoResponse])
async def obtener_historial_escaneos(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Obtiene el historial de documentos escaneados por el usuario."""
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
    """Obtiene un documento por su ID con control de acceso."""
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)
    return documento


@router.put("/{documento_id:int}", response_model=esquemas.DocumentoProcesadoResponse)
async def actualizar_documento(
    documento_id: int,
    payload: esquemas.DocumentoProcesadoUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Actualiza datos y partidas de un documento existente."""
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    if documento.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El documento está bloqueado y no se puede modificar.",
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
    if payload.dua_generado is not None:
        documento.dua_generado = payload.dua_generado

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

    await registrar_auditoria(db, usuario_actual.id, "Actualización de Documento", f"Documento '{documento.nombre_archivo}' (ID: {documento.id}) actualizado.")
    await db.commit()
    await db.refresh(documento)
    return documento


@router.get("/{documento_id:int}/archivo")
async def servir_archivo_documento(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Sirve el archivo PDF original de un documento."""
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)
    if not documento.ruta_archivo:
        raise HTTPException(status_code=404, detail="Archivo no encontrado para este documento.")
    ruta_completa = os.path.join(UPLOAD_DIR, documento.ruta_archivo)
    if not os.path.exists(ruta_completa):
        raise HTTPException(status_code=404, detail="El archivo físico ya no está disponible en el servidor.")
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
    """Aprueba un documento o lo envía a revisión administrativa."""
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)
    rol = await obtener_rol_usuario(usuario_actual, db)
    es_admin = rol == "Administrador"

    if documento.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El documento está bloqueado y no se puede aprobar.",
        )

    if payload.nuevo_total is not None:
        documento.total_cif = payload.nuevo_total

    if payload.solicitar_revision and not es_admin:
        documento.estado = "Pendiente Aprobación Admin"
        mensaje = "Operación enviada a revisión superior (Riesgo Alto)."

        await registrar_auditoria(db, usuario_actual.id, "Solicitud de Revisión", f"Documento '{documento.nombre_archivo}' (ID: {documento.id}) enviado a revisión superior.")

        admins = await db.execute(
            select(modelos.Usuario)
            .join(modelos.Rol)
            .filter(modelos.Rol.nombre == "Administrador")
        )
        for admin in admins.scalars().all():
            notif = modelos.Notificacion(
                titulo="Solicitud de Revisión",
                mensaje=f"{usuario_actual.nombre} solicita revisión del documento '{documento.nombre_archivo}' (Riesgo Alto).",
                tipo="alerta",
                documento_id=documento.id,
                usuario_destino_id=admin.id,
                usuario_origen_id=usuario_actual.id,
            )
            db.add(notif)
    else:
        documento.estado = "Aprobado"
        mensaje = "Documento aprobado y sincronizado con éxito."

        await registrar_auditoria(db, usuario_actual.id, "Aprobación de Documento", f"Documento '{documento.nombre_archivo}' (ID: {documento.id}) aprobado. Total CIF: {documento.total_cif}")

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
    """Prevalida, aprueba y bloquea un documento definitivamente."""
    if not payload.confirmar:
        raise HTTPException(status_code=400, detail="Debes confirmar el bloqueo del documento.")

    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    if documento.bloqueado:
        raise HTTPException(
            status_code=409,
            detail=f"El documento ya está bloqueado en estado '{documento.estado}'. "
                   "No se puede modificar.",
        )

    rol = await obtener_rol_usuario(usuario_actual, db)
    es_admin = rol == "Administrador"

    documento.estado = "Aprobado"
    documento.bloqueado = True
    documento.fecha_bloqueo = datetime.utcnow()
    documento.bloqueado_por_id = usuario_actual.id

    await registrar_auditoria(db, usuario_actual.id, "Prevalidación y Bloqueo", (
            f"Documento '{documento.nombre_archivo}' (ID: {documento.id}) "
            f"cambiado a estado 'Aprobado' y bloqueado contra modificaciones."
        ))

    if documento.usuario_id and documento.usuario_id != usuario_actual.id:
        notif = modelos.Notificacion(
            titulo="Documento Prevalidado y Bloqueado",
            mensaje=(
                f"El documento '{documento.nombre_archivo}' ha sido aprobado y "
                f"bloqueado por {usuario_actual.nombre}. Ya está listo para exportación."
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
        "mensaje": "Documento prevalidado, aprobado y bloqueado con éxito.",
        "estado": documento.estado,
        "bloqueado": documento.bloqueado,
    }


AVANZAR_ESTADOS_VALIDOS = {
    "En Revision": ["Presentado"],
    "Presentado": ["En Aforo Documental"],
    "En Aforo Documental": ["En Aforo Fisico", "Liquidado"],
    "En Aforo Fisico": ["Liquidado"],
    "Liquidado": ["Liberado"],
    "Liberado": [],
}


@router.put("/{documento_id:int}/avanzar-estado-aduanero")
async def avanzar_estado_aduanero(
    documento_id: int,
    payload: esquemas.AvanzarEstadoAduaneroRequest,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Avanza el estado aduanero de un documento."""
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    estado_actual = documento.estado_aduanero or "En Revision"
    nuevo_estado = payload.estado

    if nuevo_estado not in AVANZAR_ESTADOS_VALIDOS.get(estado_actual, []):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede pasar de '{estado_actual}' a '{nuevo_estado}'. "
                   f"Transiciones permitidas: {AVANZAR_ESTADOS_VALIDOS.get(estado_actual, [])}",
        )

    documento.estado_aduanero = nuevo_estado

    now = datetime.utcnow()
    if nuevo_estado == "Presentado":
        documento.fecha_presentacion = now
    elif nuevo_estado == "En Aforo Documental":
        documento.fecha_aforo_documental = now
    elif nuevo_estado == "En Aforo Fisico":
        documento.fecha_aforo_fisico = now
    elif nuevo_estado == "Liquidado":
        documento.fecha_liquidacion = now
    elif nuevo_estado == "Liberado":
        documento.fecha_liberacion = now

    await registrar_auditoria(db, usuario_actual.id, "Avance Estado Aduanero", f"Documento '{documento.nombre_archivo}' (ID: {documento.id}) cambió de estado aduanero '{estado_actual}' → '{nuevo_estado}'.")
    await db.commit()

    return {
        "mensaje": f"Estado aduanero actualizado a '{nuevo_estado}'.",
        "estado_aduanero": documento.estado_aduanero,
    }


@router.put("/{documento_id:int}/despachante")
async def asignar_despachante(
    documento_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Asigna un despachante a un documento."""
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
    """Exporta los datos del documento como XML de intercambio."""
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

    await registrar_auditoria(db, usuario_actual.id, "Exportación de Archivo de Intercambio (XML)", (
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
    """Exporta los datos del documento como JSON de intercambio."""
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

    await registrar_auditoria(db, usuario_actual.id, "Exportación de Archivo de Intercambio (JSON)", (
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
    """Elimina un documento y su archivo físico del servidor."""
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)
    rol = await obtener_rol_usuario(usuario_actual, db)
    es_admin = rol == "Administrador"

    if not es_admin and documento.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El documento está bloqueado (Prevalidado / Aprobado) y no puede eliminarse.",
        )

    if documento.ruta_archivo:
        ruta_completa = os.path.join(UPLOAD_DIR, documento.ruta_archivo)
        if os.path.exists(ruta_completa):
            os.remove(ruta_completa)

    await registrar_auditoria(db, usuario_actual.id, "Eliminación de Documento", f"Documento '{documento.nombre_archivo}' (ID: {documento.id}) eliminado por {usuario_actual.nombre}.")
    await db.delete(documento)
    await db.commit()
    return None


@router.get("/{documento_id:int}/observaciones")
async def obtener_observaciones(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Obtiene las observaciones de un documento."""
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
    """Agrega una observación a un documento."""
    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    if documento.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El documento está bloqueado y no se pueden agregar observaciones.",
        )

    nueva_obs = modelos.Observacion(
        contenido=obs.contenido,
        tipo=obs.tipo,
        documento_id=documento_id,
        usuario_id=usuario_actual.id,
    )
    db.add(nueva_obs)

    await registrar_auditoria(db, usuario_actual.id, "Observación Agregada", f"Observación añadida al documento '{documento.nombre_archivo}' (ID: {documento.id}): {obs.contenido[:100]}")
    await db.commit()
    await db.refresh(nueva_obs)

    return {"id": nueva_obs.id, "mensaje": "Observación registrada correctamente."}


@router.get("/notificaciones/mis")
async def obtener_mis_notificaciones(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Obtiene las notificaciones del usuario autenticado."""
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
    """Marca una notificación como leída."""
    resultado = await db.execute(
        select(modelos.Notificacion)
        .filter(modelos.Notificacion.id == notificacion_id)
        .filter(modelos.Notificacion.usuario_destino_id == usuario_actual.id)
    )
    notif = resultado.scalars().first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada.")

    notif.leida = True
    await db.commit()
    return {"mensaje": "Notificación marcada como leída."}


@router.patch("/notificaciones/leer-todas")
async def marcar_todas_leidas(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Marca todas las notificaciones como leídas."""
    await db.execute(
        update(modelos.Notificacion)
        .where(modelos.Notificacion.usuario_destino_id == usuario_actual.id)
        .where(modelos.Notificacion.leida == False)
        .values(leida=True)
    )
    await db.commit()
    return {"mensaje": "Todas las notificaciones marcadas como leídas."}


@router.post("/{documento_id:int}/solicitar-aclaracion")
async def solicitar_aclaracion_cliente(
    documento_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Solicita una aclaración al cliente sobre un documento."""
    mensaje = payload.get("mensaje", "").strip()
    if not mensaje:
        raise HTTPException(status_code=400, detail="El mensaje de aclaración es obligatorio.")

    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    if documento.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El documento está bloqueado y no se pueden solicitar aclaraciones.",
        )

    observacion = modelos.Observacion(
        contenido=f"[ACLARACIÓN AL CLIENTE] {mensaje}",
        tipo="correccion",
        documento_id=documento_id,
        usuario_id=usuario_actual.id,
    )
    db.add(observacion)

    documento.estado = "En Espera"

    await registrar_auditoria(db, usuario_actual.id, "Solicitud de Aclaración", f"Solicitud de aclaración enviada para '{documento.nombre_archivo}' (ID: {documento.id}): {mensaje[:200]}")

    await db.commit()

    return {
        "mensaje": "Solicitud de aclaración enviada. El documento queda en estado 'En Espera'.",
        "estado": "En Espera",
    }


@router.get("/alertas")
async def obtener_alertas(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Genera alertas de documentos estancados, V°B° y garantías."""
    from datetime import datetime, timedelta
    from sqlalchemy import func, and_

    ahora = datetime.utcnow()
    alertas = []

    docs = await db.execute(
        select(modelos.DocumentoProcesado).filter(
            modelos.DocumentoProcesado.usuario_id == usuario_actual.id
        )
    )
    documentos = docs.scalars().all()

    ESTADOS_STANCADOS = {
        "Presentado": (5, "Documento presentado sin avance de aforo"),
        "En Aforo Documental": (3, "Aforo documental sin finalizar"),
        "En Aforo Fisico": (3, "Aforo físico sin finalizar"),
        "Pendiente Aprobación Admin": (2, "Pendiente de aprobación del administrador"),
    }

    for d in documentos:
        estado = d.estado_aduanero
        if estado in ESTADOS_STANCADOS:
            dias_max, mensaje = ESTADOS_STANCADOS[estado]
            fecha_ref = None
            if estado == "Presentado":
                fecha_ref = d.fecha_presentacion
            elif estado == "En Aforo Documental":
                fecha_ref = d.fecha_aforo_documental
            elif estado == "En Aforo Fisico":
                fecha_ref = d.fecha_aforo_fisico
            elif estado == "Pendiente Aprobación Admin":
                fecha_ref = d.fecha_analisis

            if fecha_ref and (ahora - fecha_ref).days >= dias_max:
                alertas.append({
                    "tipo": "estancado",
                    "severidad": "alta" if (ahora - fecha_ref).days >= dias_max * 2 else "media",
                    "documento_id": d.id,
                    "nombre_archivo": d.nombre_archivo,
                    "estado_actual": estado,
                    "dias_detenido": (ahora - fecha_ref).days,
                    "mensaje": f"{mensaje} ({d.nombre_archivo})",
                })

    # V°B° pendientes antiguos o sin fecha de gestión
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
                "mensaje": f"V°B° de {vb.entidad} pendiente desde hace {(ahora - vb.fecha_gestion).days} días",
            })

    # Garantías próximas a vencer
    gts = await db.execute(
        select(modelos.Garantia)
        .join(modelos.DocumentoProcesado)
        .filter(
            modelos.DocumentoProcesado.usuario_id == usuario_actual.id,
            modelos.Garantia.estado == "Vigente",
            modelos.Garantia.fecha_vencimiento.isnot(None),
        )
    )
    for g in gts.scalars().all():
        dias_restantes = (g.fecha_vencimiento - ahora).days
        if 0 <= dias_restantes <= 15:
            alertas.append({
                "tipo": "garantia_proxima_vencer",
                "severidad": "alta" if dias_restantes <= 3 else "media",
                "documento_id": g.documento_id,
                "nombre_archivo": g.documento_rel.nombre_archivo if g.documento_rel else "",
                "estado_actual": g.tipo,
                "dias_detenido": dias_restantes,
                "mensaje": f"{g.tipo} #{g.numero} vence en {dias_restantes} día(s)",
            })
        elif dias_restantes < 0:
            alertas.append({
                "tipo": "garantia_vencida",
                "severidad": "alta",
                "documento_id": g.documento_id,
                "nombre_archivo": g.documento_rel.nombre_archivo if g.documento_rel else "",
                "estado_actual": g.tipo,
                "dias_detenido": abs(dias_restantes),
                "mensaje": f"{g.tipo} #{g.numero} vencida hace {abs(dias_restantes)} día(s)",
            })

    alertas.sort(key=lambda a: {"alta": 0, "media": 1, "baja": 2}.get(a["severidad"], 3))

    return alertas[:20]


@router.get("/monitoreo")
async def obtener_monitoreo(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Devuelve documentos agrupados por estado aduanero."""
    from sqlalchemy import func

    ORDEN = ["En Revision", "Presentado", "En Aforo Documental", "En Aforo Fisico", "Liquidado", "Liberado"]
    COLORES = {
        "En Revision": "var(--yellow)", "Presentado": "var(--primary)",
        "En Aforo Documental": "var(--blue)", "En Aforo Fisico": "var(--purple)",
        "Liquidado": "var(--green)", "Liberado": "var(--accent)",
    }

    result = await db.execute(
        select(modelos.DocumentoProcesado).filter(
            modelos.DocumentoProcesado.usuario_id == usuario_actual.id
        ).order_by(modelos.DocumentoProcesado.fecha_analisis.desc())
    )
    docs = result.scalars().all()

    agrupados = {}
    for est in ORDEN:
        agrupados[est] = []

    for d in docs:
        est = d.estado_aduanero or "En Revision"
        if est in agrupados:
            agrupados[est].append({
                "id": d.id,
                "nombre_archivo": d.nombre_archivo,
                "proveedor": d.proveedor,
                "total_cif": d.total_cif,
                "riesgo": d.riesgo,
                "fecha_analisis": d.fecha_analisis.isoformat() if d.fecha_analisis else None,
            })

    return {
        "columnas": [
            {"estado": est, "color": COLORES.get(est, "var(--text-muted)"), "documentos": agrupados[est]}
            for est in ORDEN
        ]
    }


@router.get("/metrics")
async def obtener_metricas_agente(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Métricas de desempeño del agente (totales, aprobados, riesgo)."""
    base = select(modelos.DocumentoProcesado).filter(
        modelos.DocumentoProcesado.usuario_id == usuario_actual.id
    )

    # Total de documentos del agente
    total = await db.execute(select(func.count()).select_from(base.subquery()))
    total_docs = total.scalar() or 0

    # Pendientes (En Revision)
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

    # Aprobados este mes
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

    # Tasa de riesgo alto
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

    # Pendientes de aprobacion admin
    pend_admin_q = await db.execute(
        select(func.count())
        .select_from(modelos.DocumentoProcesado)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == usuario_actual.id,
            modelos.DocumentoProcesado.estado == "Pendiente Aprobación Admin",
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
    """Documentos pendientes de clasificar, despachante, V°B° o DUA."""
    uid = usuario_actual.id

    # 1. Docs con partidas sin clasificar (partida_corregida vacia)
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

    # 2. Docs sin despachante asignado
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

    # 3. Docs con V°B° pendientes
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

    # 4. Docs sin DUA generado
    docs_sin_dua_q = await db.execute(
        select(modelos.DocumentoProcesado.id, modelos.DocumentoProcesado.nombre_archivo)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == uid,
            modelos.DocumentoProcesado.bloqueado == False,
            modelos.DocumentoProcesado.dua_generado == False,
        ))
    )
    docs_sin_dua = [
        {"id": r.id, "nombre_archivo": r.nombre_archivo}
        for r in docs_sin_dua_q.all()
    ]

    return {
        "sin_clasificar": docs_sin_clasificar,
        "sin_despachante": docs_sin_despachante,
        "vbb_pendientes": docs_vbb_pendientes,
        "sin_dua": docs_sin_dua,
    }


@router.get("/vencimientos")
async def obtener_vencimientos(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Garantías próximas a vencer y documentos estancados."""
    uid = usuario_actual.id
    hoy = datetime.utcnow()

    # 1. Garantias por vencer (proximos 30 dias) o vencidas
    garantias = await db.execute(
        select(
            modelos.Garantia.id,
            modelos.Garantia.tipo,
            modelos.Garantia.numero,
            modelos.Garantia.fecha_vencimiento,
            modelos.Garantia.estado,
            modelos.Garantia.documento_id,
            modelos.DocumentoProcesado.nombre_archivo,
        )
        .join(modelos.DocumentoProcesado, modelos.DocumentoProcesado.id == modelos.Garantia.documento_id)
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == uid,
            modelos.Garantia.estado == "Vigente",
            modelos.Garantia.fecha_vencimiento != None,
        ))
    )
    garantias_proximas = []
    for g in garantias.all():
        dias_restantes = (g.fecha_vencimiento - hoy).days if g.fecha_vencimiento else None
        if dias_restantes is not None and dias_restantes <= 30:
            garantias_proximas.append({
                "id": g.id,
                "tipo": g.tipo,
                "numero": g.numero,
                "fecha_vencimiento": g.fecha_vencimiento.isoformat(),
                "dias_restantes": dias_restantes,
                "documento_id": g.documento_id,
                "nombre_archivo": g.nombre_archivo,
            })

    # 2. Docs estancados en estados administrativos (Presentado, Aforo Documental, Aforo Fisico > 5 dias)
    estancados = await db.execute(
        select(
            modelos.DocumentoProcesado.id,
            modelos.DocumentoProcesado.nombre_archivo,
            modelos.DocumentoProcesado.estado_aduanero,
            modelos.DocumentoProcesado.fecha_analisis,
        )
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == uid,
            modelos.DocumentoProcesado.estado_aduanero.in_([
                "Presentado", "En Aforo Documental", "En Aforo Fisico"
            ]),
            modelos.DocumentoProcesado.fecha_analisis != None,
        ))
    )
    docs_estancados = []
    for d in estancados.all():
        dias_estancado = (hoy - d.fecha_analisis).days if d.fecha_analisis else 0
        if dias_estancado >= 5:
            docs_estancados.append({
                "id": d.id,
                "nombre_archivo": d.nombre_archivo,
                "estado_aduanero": d.estado_aduanero,
                "dias_estancado": dias_estancado,
            })

    # 3. Docs pendientes de aprobacion admin por > 3 dias
    pend_admin = await db.execute(
        select(
            modelos.DocumentoProcesado.id,
            modelos.DocumentoProcesado.nombre_archivo,
            modelos.DocumentoProcesado.fecha_analisis,
        )
        .where(and_(
            modelos.DocumentoProcesado.usuario_id == uid,
            modelos.DocumentoProcesado.estado == "Pendiente Aprobación Admin",
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
        "garantias_proximas": garantias_proximas,
        "docs_estancados": docs_estancados,
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
    """Calcula el costo total nacionalizado (landed cost) de un documento."""
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


@router.get("/proveedores/perfiles")
async def obtener_perfiles_proveedores(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Perfiles de riesgo y estadísticas por proveedor."""
    from sqlalchemy import func, case

    resultado = await db.execute(
        select(
            modelos.DocumentoProcesado.proveedor,
            func.count(modelos.DocumentoProcesado.id).label("total_operaciones"),
            func.sum(case((modelos.DocumentoProcesado.riesgo == "alto", 1), else_=0)).label("riesgo_alto"),
            func.sum(case((modelos.DocumentoProcesado.riesgo == "medio", 1), else_=0)).label("riesgo_medio"),
            func.sum(case((modelos.DocumentoProcesado.riesgo == "bajo", 1), else_=0)).label("riesgo_bajo"),
            func.avg(modelos.DocumentoProcesado.total_cif).label("promedio_cif"),
            func.max(modelos.DocumentoProcesado.fecha_analisis).label("ultima_operacion"),
        )
        .filter(modelos.DocumentoProcesado.proveedor.isnot(None))
        .filter(modelos.DocumentoProcesado.usuario_id == usuario_actual.id)
        .group_by(modelos.DocumentoProcesado.proveedor)
        .order_by(desc(func.count(modelos.DocumentoProcesado.id)))
    )
    filas = resultado.mappings().all()

    perfiles = []
    for f in filas:
        total = f["total_operaciones"]
        alto = f["riesgo_alto"] or 0
        tasa_riesgo = round((alto / total * 100), 1) if total > 0 else 0

        if tasa_riesgo >= 50:
            nivel = "critico"
        elif tasa_riesgo >= 25:
            nivel = "elevado"
        elif alto > 0:
            nivel = "moderado"
        else:
            nivel = "confiable"

        perfiles.append(
            {
                "proveedor": f["proveedor"],
                "total_operaciones": total,
                "riesgo_alto": alto,
                "riesgo_medio": f["riesgo_medio"] or 0,
                "riesgo_bajo": f["riesgo_bajo"] or 0,
                "tasa_riesgo_porcentaje": tasa_riesgo,
                "nivel_proveedor": nivel,
                "promedio_cif": round(f["promedio_cif"] or 0, 2),
                "ultima_operacion": f["ultima_operacion"].isoformat() if f["ultima_operacion"] else None,
            }
        )

    return perfiles


@router.post("/{documento_id:int}/generar-dua")
async def generar_dua(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Genera un DUA simulado con los datos del documento."""
    from datetime import datetime

    documento = await obtener_documento_seguro(documento_id, usuario_actual, db)

    partidas = await db.execute(
        select(modelos.Partida).filter(modelos.Partida.documento_id == documento_id)
    )
    items = partidas.scalars().all()

    despachante = None
    if documento.despachante_id:
        despachante = await db.get(modelos.Despachante, documento.despachante_id)

    fob = sum(p.cantidad * p.precio_unitario for p in items if p.cantidad and p.precio_unitario)
    flete = getattr(documento, "flete", None) or 0
    seguro = getattr(documento, "seguro", None) or 0
    otros = getattr(documento, "otros", None) or 0
    cif = fob + float(flete) + float(seguro) + float(otros)
    advalorem = cif * 0.06
    iva = (cif + advalorem) * 0.19
    total = cif + advalorem + iva

    dua = {
        "encabezado": {
            "tipo_operacion": "Importacion",
            "regimen": "Importacion a consumo",
            "documento_id": documento_id,
            "nombre_archivo": documento.nombre_archivo,
            "fecha_generacion": datetime.utcnow().isoformat(),
            "estado_aduanero": documento.estado_aduanero or "En Revision",
        },
        "importador": {
            "nombre": documento.cliente or "N/E",
            "proveedor": documento.proveedor or "N/E",
        },
        "despachante": {
            "nombre": despachante.nombre if despachante else "N/E",
            "rut": despachante.rut if despachante else "",
        },
        "valores": {
            "fob": round(fob, 2),
            "flete": float(flete),
            "seguro": float(seguro),
            "otros": float(otros),
            "cif": round(cif, 2),
            "advalorem_6": round(advalorem, 2),
            "iva_19": round(iva, 2),
            "total_tributos": round(advalorem + iva, 2),
            "total_landed": round(total, 2),
        },
        "partidas": [
            {
                "orden": i + 1,
                "descripcion": p.descripcion,
                "cantidad": p.cantidad,
                "precio_unitario": p.precio_unitario,
                "subtotal": round(p.cantidad * p.precio_unitario, 2),
                "partida_arancelaria": p.partida_corregida or p.partida_sugerida or "",
            }
            for i, p in enumerate(items)
        ],
    }

    await registrar_auditoria(db, usuario_actual.id, "Generacion DUA", f"DUA generado para '{documento.nombre_archivo}' (ID: {documento.id})")
    documento.dua_generado = True
    await db.commit()

    return dua
