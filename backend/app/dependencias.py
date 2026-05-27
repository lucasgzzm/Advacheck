from datetime import datetime, timedelta
from typing import Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from .base_datos import get_db
from .modelos import Usuario, Rol
from .seguridad import decodificar_token
from .config import SESSION_INACTIVITY_MINUTES

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

usuarios_conectados: Dict[int, datetime] = {}


def limpiar_sesiones_expiradas():
    """Elimina del registro las sesiones que excedieron el tiempo de inactividad."""
    ahora = datetime.now()
    ids_expirados = [
        uid for uid, ultimo_acceso in usuarios_conectados.items()
        if ahora - ultimo_acceso > timedelta(minutes=SESSION_INACTIVITY_MINUTES)
    ]
    for uid in ids_expirados:
        usuarios_conectados.pop(uid, None)


async def obtener_usuario_actual(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    """Valida el token JWT y retorna el usuario autenticado."""
    payload = decodificar_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acceso inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token no contiene identificación"
        )

    resultado = await db.execute(
        select(Usuario).filter(Usuario.email == email)
    )
    usuario = resultado.scalars().first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )

    usuarios_conectados[usuario.id] = datetime.now()
    return usuario


async def obtener_admin_actual(
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db)
):
    """Retorna el usuario solo si tiene rol de Administrador."""
    resultado = await db.execute(
        select(Rol).filter(Rol.id == usuario_actual.rol_id)
    )
    rol = resultado.scalars().first()

    if not rol or rol.nombre != "Administrador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes privilegios suficientes para esta acción."
        )
    return usuario_actual


async def obtener_rol_usuario(usuario: Usuario, db: AsyncSession) -> str:
    """Obtiene el nombre del rol de un usuario desde la base de datos."""
    resultado = await db.execute(select(Rol).filter(Rol.id == usuario.rol_id))
    rol = resultado.scalars().first()
    return rol.nombre if rol else "Agente"


async def obtener_documento_seguro(
    documento_id: int,
    usuario_actual: Usuario,
    db: AsyncSession,
) -> "DocumentoProcesado":
    """Retorna un documento si existe y el usuario tiene permiso para acceder."""
    from .modelos import DocumentoProcesado

    rol = await obtener_rol_usuario(usuario_actual, db)
    es_admin = rol == "Administrador"

    query = (
        select(DocumentoProcesado)
        .options(selectinload(DocumentoProcesado.partidas))
        .filter(DocumentoProcesado.id == documento_id)
    )
    if not es_admin:
        query = query.filter(DocumentoProcesado.usuario_id == usuario_actual.id)

    resultado = await db.execute(query)
    documento = resultado.scalar_one_or_none()
    if not documento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El documento no existe o no tienes permisos para acceder a él.",
        )
    return documento
