from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..base_datos import get_db
from .. import modelos
from ..dependencias import obtener_usuario_actual, obtener_admin_actual

router = APIRouter(prefix="/api/despachantes", tags=["Despachantes"])




@router.get("")
async def listar_despachantes(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Lista los despachantes activos disponibles."""
    result = await db.execute(
        select(modelos.Despachante).filter(modelos.Despachante.activo == True).order_by(modelos.Despachante.nombre)
    )
    return result.scalars().all()


@router.post("")
async def crear_despachante(
    data: esquemas.DespachanteCreate,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_admin_actual),
):
    """Crea un nuevo despachante (solo admin)."""
    desp = modelos.Despachante(**data.model_dump())
    db.add(desp)
    await db.commit()
    await db.refresh(desp)
    return desp


@router.put("/{despachante_id}")
async def actualizar_despachante(
    despachante_id: int,
    data: esquemas.DespachanteCreate,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_admin_actual),
):
    """Actualiza los datos de un despachante (solo admin)."""
    desp = await db.get(modelos.Despachante, despachante_id)
    if not desp:
        raise HTTPException(404, "Despachante no encontrado")
    for k, v in data.model_dump().items():
        setattr(desp, k, v)
    await db.commit()
    await db.refresh(desp)
    return desp


@router.delete("/{despachante_id}")
async def eliminar_despachante(
    despachante_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_admin_actual),
):
    """Desactiva un despachante (solo admin)."""
    desp = await db.get(modelos.Despachante, despachante_id)
    if not desp:
        raise HTTPException(404, "Despachante no encontrado")
    desp.activo = False
    await db.commit()
    return {"mensaje": "Despachante desactivado"}
