from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List

from .. import esquemas, modelos
from ..base_datos import get_db
from ..dependencias import obtener_usuario_actual, obtener_documento_seguro

router = APIRouter(prefix="/api/garantias", tags=["Garantías"])


@router.get("/{documento_id}", response_model=List[esquemas.GarantiaResponse])
async def listar_garantias(
    documento_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Lista las garantías asociadas a un documento."""
    await obtener_documento_seguro(documento_id, usuario_actual, db)
    resultado = await db.execute(
        select(modelos.Garantia)
        .filter(modelos.Garantia.documento_id == documento_id)
        .order_by(desc(modelos.Garantia.fecha_creacion))
    )
    return resultado.scalars().all()


@router.post("/{documento_id}", response_model=esquemas.GarantiaResponse, status_code=status.HTTP_201_CREATED)
async def crear_garantia(
    documento_id: int,
    body: esquemas.GarantiaCreate,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Registra una nueva garantía para un documento."""
    await obtener_documento_seguro(documento_id, usuario_actual, db)

    garantia = modelos.Garantia(
        documento_id=documento_id,
        tipo=body.tipo,
        numero=body.numero,
        monto=body.monto,
        moneda=body.moneda,
        fecha_emision=body.fecha_emision,
        fecha_vencimiento=body.fecha_vencimiento,
        estado=body.estado,
        emisor=body.emisor,
        observaciones=body.observaciones,
    )
    db.add(garantia)
    await db.commit()
    await db.refresh(garantia)
    return garantia


@router.delete("/{garantia_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_garantia(
    garantia_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Elimina una garantía existente."""
    resultado = await db.execute(
        select(modelos.Garantia).filter(modelos.Garantia.id == garantia_id)
    )
    garantia = resultado.scalars().first()
    if not garantia:
        raise HTTPException(status_code=404, detail="Garantía no encontrada")
    await obtener_documento_seguro(garantia.documento_id, usuario_actual, db)
    await db.delete(garantia)
    await db.commit()
