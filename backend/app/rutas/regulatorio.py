from ..servicios.servicio_auditoria import registrar_auditoria
from ..catalogo_regulatorio import detectar_entidades_para_partida
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from .. import modelos
from ..base_datos import get_db
from ..dependencias import obtener_usuario_actual, obtener_documento_seguro

router = APIRouter(prefix="/api/regulatorio", tags=["Regulatorio"])

@router.get("/entidades-por-partida/{codigo}")
async def entidades_para_partida(codigo: str):
    entidades = detectar_entidades_para_partida(codigo)
    return {
        "codigo": codigo,
        "entidades": entidades,
        "total": len(entidades),
    }

@router.get("/documentos/{documento_id}/vistos-buenos")
async def obtener_vistos_buenos(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    await obtener_documento_seguro(documento_id, usuario_actual, db)
    resultado = await db.execute(
        select(modelos.VistoBueno)
        .filter(modelos.VistoBueno.documento_id == documento_id)
    )
    return resultado.scalars().all()

@router.post("/documentos/{documento_id}/vistos-buenos/sincronizar")
async def sincronizar_vistos_buenos(
    documento_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    await obtener_documento_seguro(documento_id, usuario_actual, db)
    partidas = payload.get("partidas", [])
    entidades_detectadas = []
    for p in partidas:
        entidades_detectadas.extend(detectar_entidades_para_partida(p))

    entidades_vistas = set()
    entidades_unicas = []
    for ent in entidades_detectadas:
        key = (ent["entidad"], ent["tipo_permiso"])
        if key not in entidades_vistas:
            entidades_vistas.add(key)
            entidades_unicas.append(ent)

    resultado = await db.execute(
        select(modelos.VistoBueno)
        .filter(modelos.VistoBueno.documento_id == documento_id)
    )
    existentes = resultado.scalars().all()
    existentes_set = {(vb.entidad, vb.tipo_permiso) for vb in existentes}

    creados = 0
    for ent in entidades_unicas:
        key = (ent["entidad"], ent["tipo_permiso"])
        if key not in existentes_set:
            nuevo = modelos.VistoBueno(
                entidad=ent["entidad"],
                tipo_permiso=ent["tipo_permiso"],
                estado="pendiente",
                documento_id=documento_id,
                usuario_id=usuario_actual.id,
            )
            db.add(nuevo)
            creados += 1
            existentes_set.add(key)

    if creados > 0:
        await db.commit()

    resultado_final = await db.execute(
        select(modelos.VistoBueno)
        .filter(modelos.VistoBueno.documento_id == documento_id)
    )
    return {
        "creados": creados,
        "vistos_buenos": resultado_final.scalars().all(),
    }

@router.patch("/vistos-buenos/{vb_id}")
async def actualizar_visto_bueno(
    vb_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    resultado = await db.execute(
        select(modelos.VistoBueno).filter(modelos.VistoBueno.id == vb_id)
    )
    vb = resultado.scalars().first()
    if not vb:
        raise HTTPException(status_code=404, detail="V°B° no encontrado.")
    await obtener_documento_seguro(vb.documento_id, usuario_actual, db)

    if "estado" in payload:
        vb.estado = payload["estado"]
    if "observaciones" in payload:
        vb.observaciones = payload["observaciones"]
    if "archivo_nombre" in payload:
        vb.archivo_nombre = payload["archivo_nombre"]

    vb.fecha_gestion = datetime.now()
    await db.commit()

    await registrar_auditoria(db, usuario_actual.id, "Actualizacion de V°B°", f"V°B° ID {vb.id}: {vb.entidad} - {vb.tipo_permiso} -> {vb.estado}")
    await db.commit()

    return {"mensaje": f"V°B° de {vb.entidad} actualizado a '{vb.estado}'."}
