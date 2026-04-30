from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .. import schemas, models
from ..database import get_db
from ..auth_utils import (
    verify_password, 
    create_access_token, 
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ACCESS_TOKEN_EXPIRE_DAYS_REMEMBER,
    decode_access_token,
    get_password_hash
)
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

router = APIRouter(
    prefix="/api/auth",
    tags=["Autenticación"]
)


@router.post("/login", response_model=schemas.Token)
async def login(login_req: schemas.LoginRequest, db: AsyncSession = Depends(get_db)):
    """Inicia sesión y devuelve un token JWT."""
    # Buscar usuario por email
    result = await db.execute(select(models.Usuario).filter(models.Usuario.email == login_req.email))
    user = result.scalars().first()
    
    # Validar credenciales
    if not user or not verify_password(login_req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verificar que la cuenta esté activa
    if not user.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu cuenta ha sido desactivada"
        )
    
    # Determinar duración del token según "Recordarme"
    if login_req.remember:
        expires_delta = timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS_REMEMBER)
    else:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Obtener nombre del rol para incluirlo en el token
    result_rol = await db.execute(select(models.Rol).filter(models.Rol.id == user.rol_id))
    rol = result_rol.scalars().first()
    
    access_token = create_access_token(
        data={"sub": user.email, "role": rol.nombre if rol else "Normal"},
        expires_delta=expires_delta
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_name": user.nombre,
        "user_role": rol.nombre if rol else "Normal"
    }


@router.post("/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
async def register(req: schemas.RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Registra un nuevo usuario y devuelve un token JWT para auto-login."""
    # Verificar si el email ya existe
    result = await db.execute(select(models.Usuario).filter(models.Usuario.email == req.email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico ya está registrado en el sistema."
        )
    
    # Asignar rol por defecto (Agente)
    result_rol = await db.execute(select(models.Rol).filter(models.Rol.nombre == "Agente"))
    default_role = result_rol.scalars().first()
    if not default_role:
        result_rol = await db.execute(select(models.Rol).filter(models.Rol.nombre != "Administrador").limit(1))
        default_role = result_rol.scalars().first()
    
    # Crear el usuario
    nuevo_usuario = models.Usuario(
        nombre=req.nombre,
        email=req.email,
        hashed_password=get_password_hash(req.password),
        activo=True,
        rol_id=default_role.id if default_role else 1
    )
    
    db.add(nuevo_usuario)
    await db.commit()
    await db.refresh(nuevo_usuario)
    
    # Generar token para auto-login
    expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": nuevo_usuario.email, "role": default_role.nombre if default_role else "Normal"},
        expires_delta=expires_delta
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_name": nuevo_usuario.nombre,
        "user_role": default_role.nombre if default_role else "Normal"
    }


# --- Funciones de dependencia para proteger rutas ---

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    """Extrae el usuario actual a partir del token JWT enviado en la cabecera."""
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acceso inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )
    email: str = payload.get("sub")
    if email is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="El token no contiene identificación")
    
    result = await db.execute(select(models.Usuario).filter(models.Usuario.email == email))
    user = result.scalars().first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    return user


async def get_current_admin(current_user: models.Usuario = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Verifica que el usuario actual tenga rol de Administrador."""
    result = await db.execute(select(models.Rol).filter(models.Rol.id == current_user.rol_id))
    rol = result.scalars().first()
    
    if not rol or rol.nombre != "Administrador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes privilegios suficientes para esta acción."
        )
    return current_user


@router.get("/me", response_model=schemas.UserResponse)
async def get_profile(user: models.Usuario = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Devuelve los datos del perfil del usuario autenticado."""
    result_rol = await db.execute(select(models.Rol).filter(models.Rol.id == user.rol_id))
    rol = result_rol.scalars().first()
    
    return {
        "nombre": user.nombre,
        "email": user.email,
        "rol_nombre": rol.nombre if rol else "Agente",
        "activo": user.activo
    }


@router.post("/change-password")
async def change_password(req: schemas.PasswordChangeRequest, user: models.Usuario = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Permite al usuario cambiar su contraseña."""
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Las nuevas contraseñas no coinciden")
    
    if not verify_password(req.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="La contraseña actual es incorrecta")
    
    user.hashed_password = get_password_hash(req.new_password)
    await db.commit()
    
    return {"message": "Contraseña actualizada exitosamente"}
