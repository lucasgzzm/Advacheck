from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from .configuracion import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, ACCESS_TOKEN_EXPIRE_DAYS_REMEMBER, REFRESH_TOKEN_EXPIRE_DAYS

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verificar_contrasena(contrasena_plana: str, hash_guardado: str) -> bool:
    return pwd_context.verify(contrasena_plana, hash_guardado)

def hashear_contrasena(contrasena: str) -> str:
    return pwd_context.hash(contrasena)

def crear_token(datos: dict, expiracion: timedelta) -> str:
    payload = datos.copy()
    payload["exp"] = datetime.now(timezone.utc).replace(tzinfo=None) + expiracion
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verificar_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

def crear_refresh_token(datos: dict) -> str:
    payload = datos.copy()
    payload["exp"] = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload["tipo"] = "refresh"
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

verificar_password = verificar_contrasena
generar_hash = hashear_contrasena
crear_token_acceso = crear_token
decodificar_token = verificar_token
obtener_expiracion = lambda remember: (
    timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS_REMEMBER) if remember
    else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
)
