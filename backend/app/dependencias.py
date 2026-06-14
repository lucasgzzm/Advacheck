from datetime import datetime, timedelta
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

# Esquema de autenticacion: el frontend envia el token en el header "Authorization: Bearer <token>"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Diccionario en memoria para llevar el control de usuarios con sesion activa
usuarios_conectados: Dict[int, datetime] = {}


async def obtener_usuario_actual(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> modelos.Usuario:
    """Verifica el token JWT y devuelve el usuario autenticado.
    
    Si el token no es valido o el usuario no existe, lanza error 401.
    Tambien actualiza el timestamp de actividad del usuario.
    """
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
    # Marcamos al usuario como conectado
    usuarios_conectados[usuario.id] = datetime.utcnow()
    return usuario


async def obtener_admin_actual(
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
) -> modelos.Usuario:
    """Igual que obtener_usuario_actual pero solo deja pasar a administradores."""
    if usuario_actual.rol_rel.nombre != "Administrador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren privilegios de administrador.",
        )
    return usuario_actual


async def limpiar_conexiones_inactivas():
    """Borra del diccionario a usuarios que no han tenido actividad en los ultimos minutos.
    Se llama periodicamente para mantener limpio el registro de conexiones.
    """
    ahora = datetime.utcnow()
    limite = ahora - timedelta(minutes=SESSION_INACTIVITY_MINUTES)
    inactivos = [uid for uid, ultima in usuarios_conectados.items() if ultima < limite]
    for uid in inactivos:
        del usuarios_conectados[uid]


async def obtener_documento_seguro(
    documento_id: int,
    usuario_actual: modelos.Usuario,
    db: AsyncSession,
) -> modelos.DocumentoProcesado:
    """Busca un documento y verifica que el usuario tenga permiso para verlo.
    
    Los administradores pueden ver cualquier documento.
    Los usuarios normales solo ven los que ellos mismos crearon.
    """
    # Cargamos el documento con sus partidas incluidas para evitar
    # MissingGreenlet al serializar la respuesta fuera del contexto async.
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


async def obtener_rol_usuario(usuario: modelos.Usuario, db: AsyncSession) -> str:
    """Devuelve el nombre del rol de un usuario."""
    return usuario.rol_rel.nombre


# Alias para compatibilidad
limpiar_sesiones_expiradas = limpiar_conexiones_inactivas
