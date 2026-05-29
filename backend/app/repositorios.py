"""Repositorios de datos y adaptadores entre modelos nuevos y deprecados."""

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .modelos import (
    DocumentoProcesado,
    Envio,
    Factura,
    FacturaDetalle,
    Partida,
)

logger = logging.getLogger(__name__)


# ─── ADAPTADORES ENTRE MODELOS DEPRECADOS Y NUEVOS ──────────────────


async def envio_a_documento(db: AsyncSession, envio_id: int) -> Optional[DocumentoProcesado]:
    """Busca un DocumentoProcesado cuyo nombre coincida con el Envio."""
    result = await db.execute(select(Envio).filter(Envio.id == envio_id))
    envio = result.scalars().first()
    if not envio:
        return None
    result = await db.execute(
        select(DocumentoProcesado).filter(
            DocumentoProcesado.nombre_archivo.ilike(f"%{envio.referencia_operativa}%")
        )
    )
    return result.scalars().first()


async def factura_a_documento(db: AsyncSession, factura_id: int) -> Optional[DocumentoProcesado]:
    """Busca un DocumentoProcesado por el número de factura."""
    result = await db.execute(select(Factura).filter(Factura.id == factura_id))
    factura = result.scalars().first()
    if not factura:
        return None
    result = await db.execute(
        select(DocumentoProcesado).filter(
            DocumentoProcesado.nombre_archivo.ilike(f"%{factura.numero_factura}%")
        )
    )
    return result.scalars().first()


async def factura_detalle_a_partidas(
    db: AsyncSession, factura_id: int
) -> list[Partida]:
    """Convierte FacturaDetalle deprecados a objetos Partida."""
    result = await db.execute(
        select(FacturaDetalle).filter(FacturaDetalle.factura_id == factura_id)
    )
    detalles = result.scalars().all()
    documento = await factura_a_documento(db, factura_id)
    if not documento:
        return []

    partidas = []
    for i, det in enumerate(detalles):
        partidas.append(
            Partida(
                documento_id=documento.id,
                descripcion=det.descripcion_producto,
                cantidad=det.cantidad,
                precio_unitario=det.precio_unitario,
                partida_sugerida=det.partida_arancelaria_sugerida,
                partida_corregida=det.partida_arancelaria_corregida,
                orden=i,
            )
        )
    return partidas


async def migrar_factura_a_documento(
    db: AsyncSession, factura_id: int
) -> Optional[DocumentoProcesado]:
    """Migra una Factura deprecada + sus FacturaDetalle a DocumentoProcesado + Partidas."""
    result = await db.execute(select(Factura).filter(Factura.id == factura_id))
    factura = result.scalars().first()
    if not factura:
        return None

    envio = await db.get(Envio, factura.envio_id)
    cliente_nombre = envio.cliente_rel.razon_social if envio and envio.cliente_rel else ""

    documento = DocumentoProcesado(
        nombre_archivo=f"factura_{factura.numero_factura}.pdf",
        total_cif=factura.monto_total,
        proveedor=factura.emisor_nombre,
        cliente=cliente_nombre,
        estado="En Revision",
        riesgo=factura.riesgo_calculado,
    )
    db.add(documento)
    await db.flush()

    partidas = await factura_detalle_a_partidas(db, factura_id)
    for p in partidas:
        p.documento_id = documento.id
        db.add(p)

    await db.commit()
    await db.refresh(documento)
    logger.info(f"Factura {factura_id} migrada a DocumentoProcesado {documento.id}")
    return documento
