from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, ACCESS_TOKEN_EXPIRE_DAYS_REMEMBER

pwd_context = CryptContext(schemes=["bcrypt", "sha256_crypt"], deprecated="auto")


def verificar_password(password_plano: str, hash_almacenado: str) -> bool:
    """Verifica una contraseña contra su hash almacenado."""
    return pwd_context.verify(password_plano, hash_almacenado)


def generar_hash(password: str) -> str:
    """Genera un hash seguro de la contraseña."""
    return pwd_context.hash(password)


def crear_token_acceso(datos: dict, expiracion: Optional[timedelta] = None) -> str:
    """Crea un JWT con los datos y tiempo de expiración dados."""
    datos_codificar = datos.copy()
    if not expiracion:
        expiracion = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    datos_codificar.update({"exp": datetime.utcnow() + expiracion})
    return jwt.encode(datos_codificar, SECRET_KEY, algorithm=ALGORITHM)


def decodificar_token(token: str) -> Optional[dict]:
    """Decodifica y valida un JWT, retornando su payload o None."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def obtener_expiracion(recordar: bool = False) -> timedelta:
    """Retorna el timedelta de expiración según si el usuario pidió recordatorio."""
    if recordar:
        return timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS_REMEMBER)
    return timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
