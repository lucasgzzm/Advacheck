from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from .configuracion import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, ACCESS_TOKEN_EXPIRE_DAYS_REMEMBER, REFRESH_TOKEN_EXPIRE_DAYS

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Compara una contrasena plana contra su hash guardado
def verificar_contrasena(contrasena_plana: str, hash_guardado: str) -> bool:
    return pwd_context.verify(contrasena_plana, hash_guardado)

# Genera un hash seguro de la contrasena usando bcrypt
def hashear_contrasena(contrasena: str) -> str:
    return pwd_context.hash(contrasena)

# Crea un token JWT con datos y tiempo de expiracion personalizado
def crear_token(datos: dict, expiracion: timedelta) -> str:
    payload = datos.copy()
    payload["exp"] = datetime.now(timezone.utc).replace(tzinfo=None) + expiracion
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# Decodifica y valida un token JWT, devuelve el payload o None
def verificar_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

# Genera un token de refresco con expiracion extendida
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
