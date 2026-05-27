from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import esquemas, modelos
from ..servicio_auditoria import registrar_auditoria
from ..base_datos import get_db
from ..seguridad import (
    crear_token_acceso,
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

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


@router.post("/login", response_model=esquemas.Token)
async def iniciar_sesion(
    login_req: esquemas.LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Autentica un usuario y devuelve un token JWT."""
    resultado = await db.execute(
        select(modelos.Usuario).filter(modelos.Usuario.email == login_req.email)
    )
    usuario = resultado.scalars().first()

    if not usuario or not verificar_password(login_req.password, usuario.contrasena_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if pwd_context.needs_update(usuario.contrasena_hash):
        usuario.contrasena_hash = generar_hash(login_req.password)

    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu cuenta ha sido desactivada",
        )

    rol = await obtener_rol_usuario(usuario, db)
    expiracion = obtener_expiracion(login_req.remember)
    access_token = crear_token_acceso(
        datos={"sub": usuario.email, "role": rol},
        expiracion=expiracion,
    )

    await registrar_auditoria(db, usuario.id, "Inicio de Sesión", f"El usuario '{usuario.nombre}' ({usuario.email}) inició sesión correctamente.")
    await db.commit()

    usuarios_conectados[usuario.id] = datetime.now()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_name": usuario.nombre,
        "user_role": rol,
    }


@router.post("/register", response_model=esquemas.Token, status_code=status.HTTP_201_CREATED)
async def registrar(
    req: esquemas.RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Registro público inhabilitado intencionalmente."""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="El registro público no está disponible. Contacta al administrador.",
    )


@router.post("/logout")
async def cerrar_sesion(
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
):
    """Elimina al usuario de la lista de conectados."""
    usuarios_conectados.pop(usuario_actual.id, None)
    return {"mensaje": "Sesión cerrada"}


@router.get("/me", response_model=esquemas.UserResponse)
async def obtener_perfil(
    usuario_actual: modelos.Usuario = Depends(obtener_usuario_actual),
    db: AsyncSession = Depends(get_db),
):
    """Devuelve los datos del usuario autenticado."""
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
    """Cambia la contraseña del usuario autenticado."""
    if req.new_password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Las nuevas contraseñas no coinciden",
        )

    if not verificar_password(req.current_password, usuario_actual.contrasena_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La contraseña actual es incorrecta",
        )

    usuario_actual.contrasena_hash = generar_hash(req.new_password)
    await db.commit()
    return {"message": "Contraseña actualizada exitosamente"}
