from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from .. import modelos, esquemas
from ..base_datos import get_db
from ..dependencias import obtener_usuario_actual

router = APIRouter(prefix="/api/clientes", tags=["Clientes"])


@router.get("/", response_model=List[esquemas.ClienteResponse])
async def listar_clientes(
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Lista todos los clientes del usuario autenticado."""
    resultado = await db.execute(
        select(modelos.Cliente)
        .filter(modelos.Cliente.usuario_id == usuario_actual.id)
        .order_by(modelos.Cliente.razon_social)
    )
    return resultado.scalars().all()


@router.post("/", response_model=esquemas.ClienteResponse, status_code=status.HTTP_201_CREATED)
async def crear_cliente(
    payload: esquemas.ClienteCreate,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Crea un nuevo cliente asociado al usuario."""
    existe = await db.execute(
        select(modelos.Cliente).filter(
            modelos.Cliente.identificacion_fiscal == payload.identificacion_fiscal,
            modelos.Cliente.usuario_id == usuario_actual.id,
        )
    )
    if existe.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un cliente con ese RUT/identificación fiscal.",
        )

    cliente = modelos.Cliente(
        razon_social=payload.razon_social,
        identificacion_fiscal=payload.identificacion_fiscal,
        direccion=payload.direccion,
        email=payload.email,
        telefono=payload.telefono,
        contacto_nombre=payload.contacto_nombre,
        usuario_id=usuario_actual.id,
    )
    db.add(cliente)
    await db.commit()
    await db.refresh(cliente)
    return cliente


@router.put("/{cliente_id}", response_model=esquemas.ClienteResponse)
async def actualizar_cliente(
    cliente_id: int,
    payload: esquemas.ClienteUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Actualiza los datos de un cliente existente."""
    resultado = await db.execute(
        select(modelos.Cliente).filter(
            modelos.Cliente.id == cliente_id,
            modelos.Cliente.usuario_id == usuario_actual.id,
        )
    )
    cliente = resultado.scalars().first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")

    if payload.razon_social is not None:
        cliente.razon_social = payload.razon_social
    if payload.identificacion_fiscal is not None:
        cliente.identificacion_fiscal = payload.identificacion_fiscal
    if payload.direccion is not None:
        cliente.direccion = payload.direccion
    if payload.email is not None:
        cliente.email = payload.email
    if payload.telefono is not None:
        cliente.telefono = payload.telefono
    if payload.contacto_nombre is not None:
        cliente.contacto_nombre = payload.contacto_nombre
    if payload.activo is not None:
        cliente.activo = payload.activo

    await db.commit()
    await db.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_cliente(
    cliente_id: int,
    db: AsyncSession = Depends(get_db),
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Elimina un cliente del sistema."""
    resultado = await db.execute(
        select(modelos.Cliente).filter(
            modelos.Cliente.id == cliente_id,
            modelos.Cliente.usuario_id == usuario_actual.id,
        )
    )
    cliente = resultado.scalars().first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")

    await db.delete(cliente)
    await db.commit()
