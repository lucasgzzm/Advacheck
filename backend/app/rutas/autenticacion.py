from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from .. import esquemas, modelos
from ..servicios.servicio_auditoria import registrar_auditoria
from ..base_datos import get_db
from ..limitadores import limitador_login
from ..configuracion import ACCESS_TOKEN_EXPIRE_MINUTES
from ..seguridad import (
    crear_token_acceso,
    crear_refresh_token,
    decodificar_token,
    generar_hash,
    obtener_expiracion,
    pwd_context,
    verificar_password,
)
from ..dependencias import (
    obtener_usuario_actual,
    obtener_rol_usuario,
    usuarios_conectados,
)

router = APIRouter(prefix="/api/auth", tags=["Autenticacion"])

@router.post("/login", response_model=esquemas.Token)
async def iniciar_sesion(
    login_req: esquemas.LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = request.client.host if request.client else "desconocida"
    if not await limitador_login.verificar(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos de inicio de sesion. Espera 60 segundos.",
        )

    resultado = await db.execute(
        select(modelos.Usuario)
        .options(selectinload(modelos.Usuario.rol_rel))
        .filter(modelos.Usuario.email == login_req.email)
    )
    usuario = resultado.scalars().first()

    if not usuario or not verificar_password(login_req.password, usuario.contrasena_hash):
        await limitador_login.registrar(ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contrasena incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if pwd_context.needs_update(usuario.contrasena_hash):
        usuario.contrasena_hash = generar_hash(login_req.password)

    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu cuenta ha sido desactivada",
        )

    limitador_login.resetear(ip)

    rol = await obtener_rol_usuario(usuario, db)
    expiracion = obtener_expiracion(login_req.remember)
    datos_token = {"sub": usuario.email, "role": rol}
    access_token = crear_token_acceso(
        datos=datos_token,
        expiracion=expiracion,
    )
    refresh_token = crear_refresh_token(datos_token)

    await registrar_auditoria(db, usuario.id, "Inicio de Sesion", f"El usuario '{usuario.nombre}' ({usuario.email}) inicio sesion correctamente.")
    await db.commit()

    usuarios_conectados[usuario.id] = datetime.now()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_name": usuario.nombre,
        "user_role": rol,
    }

class RefreshTokenRequest(BaseModel):
    refresh_token: str

@router.post("/refresh", response_model=esquemas.Token)
async def renovar_token(
    req: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    payload = decodificar_token(req.refresh_token)
    if not payload or payload.get("tipo") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalido o expirado",
        )

    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalido",
        )

    resultado = await db.execute(
        select(modelos.Usuario)
        .options(selectinload(modelos.Usuario.rol_rel))
        .filter(modelos.Usuario.email == email)
    )
    usuario = resultado.scalars().first()
    if not usuario or not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o desactivado",
        )

    rol = await obtener_rol_usuario(usuario, db)
    datos_token = {"sub": usuario.email, "role": rol}
    access_token = crear_token_acceso(
        datos=datos_token,
        expiracion=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = crear_refresh_token(datos_token)

    usuarios_conectados[usuario.id] = datetime.now()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_name": usuario.nombre,
        "user_role": rol,
    }

@router.post("/register", response_model=esquemas.Token, status_code=status.HTTP_201_CREATED)
async def registrar(
    req: esquemas.RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="El registro publico no esta disponible. Contacta al administrador.",
    )

@router.post("/logout")
async def cerrar_sesion(
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    usuarios_conectados.pop(usuario_actual.id, None)
    return {"mensaje": "Sesion cerrada"}

@router.get("/me", response_model=esquemas.UserResponse)
async def obtener_perfil(
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db),
):
    rol = await obtener_rol_usuario(usuario_actual, db)
    return {
        "id": usuario_actual.id,
        "nombre": usuario_actual.nombre,
        "email": usuario_actual.email,
        "rol_nombre": rol,
        "activo": usuario_actual.activo,
    }

@router.post("/change-password")
async def cambiar_password(
    req: esquemas.PasswordChangeRequest,
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db),
):
    if req.new_password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Las nuevas contrasenas no coinciden",
        )

    if not verificar_password(req.current_password, usuario_actual.contrasena_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La contrasena actual es incorrecta",
        )

    usuario_actual.contrasena_hash = generar_hash(req.new_password)
    await db.commit()
    return {"mensaje": "Contrasena actualizada exitosamente"}
