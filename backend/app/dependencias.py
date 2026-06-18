from datetime import datetime, timedelta, timezone
from typing import Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from . import modelos
from .base_datos import get_db
from .seguridad import verificar_token
from .configuracion import SESSION_INACTIVITY_MINUTES

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

usuarios_conectados: Dict[int, datetime] = {}

# Obtiene el usuario autenticado a partir del token JWT
async def obtener_usuario_actual(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> modelos.Usuario:
    payload = verificar_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
        )
    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no contiene email.",
        )
    resultado = await db.execute(
        select(modelos.Usuario)
        .options(selectinload(modelos.Usuario.rol_rel))
        .filter(modelos.Usuario.email == email)
    )
    usuario = resultado.scalar_one_or_none()
    if not usuario or not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o desactivado.",
        )
    usuarios_conectados[usuario.id] = datetime.now(timezone.utc).replace(tzinfo=None)
    return usuario

# Verifica que el usuario actual tenga rol de administrador
async def obtener_admin_actual(
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
) -> modelos.Usuario:
    if usuario_actual.rol_rel.nombre != "Administrador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren privilegios de administrador.",
        )
    return usuario_actual

# Elimina conexiones de usuarios que superaron el tiempo de inactividad
async def limpiar_conexiones_inactivas():
    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    limite = ahora - timedelta(minutes=SESSION_INACTIVITY_MINUTES)
    inactivos = [uid for uid, ultima in usuarios_conectados.items() if ultima < limite]
    for uid in inactivos:
        del usuarios_conectados[uid]

# Recupera un documento verificando que el usuario tenga acceso a el
async def obtener_documento_seguro(
    documento_id: int,
    usuario_actual: modelos.Usuario,
    db: AsyncSession,
) -> modelos.DocumentoProcesado:
    resultado = await db.execute(
        select(modelos.DocumentoProcesado)
        .options(selectinload(modelos.DocumentoProcesado.partidas))
        .filter(modelos.DocumentoProcesado.id == documento_id)
    )
    doc = resultado.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    if usuario_actual.rol_rel.nombre != "Administrador" and doc.usuario_id != usuario_actual.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para acceder a este documento.",
        )
    return doc

# Devuelve el nombre del rol de un usuario
async def obtener_rol_usuario(usuario: modelos.Usuario, db: AsyncSession) -> str:
    return usuario.rol_rel.nombre

limpiar_sesiones_expiradas = limpiar_conexiones_inactivas
