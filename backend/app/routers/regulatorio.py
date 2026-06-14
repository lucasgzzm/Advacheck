from ..services.servicio_auditoria import registrar_auditoria
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
    """Consulta las entidades regulatorias que aplican a un codigo arancelario.
    Por ejemplo: SENASA para alimentos, ISP para medicamentos, etc.
    """
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
    """Lista los V°B° (Vistos Buenos) asociados a un documento."""
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
    """Toma las partidas del documento, consulta que entidades regulatorias aplican,
    y crea los V°B° que falten. No duplica los que ya existen.
    """
    await obtener_documento_seguro(documento_id, usuario_actual, db)
    partidas = payload.get("partidas", [])
    entidades_detectadas = []
    for p in partidas:
        entidades_detectadas.extend(detectar_entidades_para_partida(p))

    resultado = await db.execute(
        select(modelos.VistoBueno)
        .filter(modelos.VistoBueno.documento_id == documento_id)
    )
    existentes = resultado.scalars().all()
    existentes_set = {(vb.entidad, vb.tipo_permiso) for vb in existentes}

    creados = 0
    for ent in entidades_detectadas:
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
    """Actualiza el estado y/o observaciones de un V°B° (pendiente -> aprobado/rechazado)."""
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

# Catalogo de Tratados de Libre Comercio por pais destino
TLC_POR_ORIGEN = {
    "CL": {"paises": ["MX", "US", "CA", "KR", "CN", "JP", "AU", "NZ"], "nombre_tlc": "Chile"},
    "MX": {"paises": ["US", "CA", "EU", "JP"], "nombre_tlc": "Mexico (T-MEC)"},
    "US": {"paises": ["MX", "CA", "KR", "SG"], "nombre_tlc": "EE.UU."},
    "CO": {"paises": ["US", "MX", "EU", "KR"], "nombre_tlc": "Colombia"},
}


@router.get("/tlc/evaluar")
async def evaluar_tlc(
    pais_origen: str = "",
    pais_destino: str = "",
    partida: str = "",
):
    """Evalua si aplica un Tratado de Libre Comercio entre el pais de origen y el de destino.
    Si aplica, el arancel preferencial es 0%.
    """
    if not pais_origen or not pais_destino:
        return {"tlc_aplica": False, "mensaje": "Faltan paises para evaluar TLC."}

    tlc_destino = TLC_POR_ORIGEN.get(pais_destino.upper())
    if tlc_destino and pais_origen.upper() in tlc_destino["paises"]:
        return {
            "tlc_aplica": True,
            "nombre_tlc": f"{tlc_destino['nombre_tlc']} - {pais_origen.upper()}",
            "arancel_preferencial": 0,
            "arancel_general": 6.0,
        }

    return {
        "tlc_aplica": False,
        "nombre_tlc": None,
        "arancel_preferencial": None,
        "arancel_general": 6.0,
    }
