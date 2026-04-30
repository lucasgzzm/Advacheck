from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext

# Parámetros de seguridad para la generación y validación de tokens JWT
SECRET_KEY = "webcheck_super_secret_key_change_me_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60        # Duración del token por defecto: 1 hora
ACCESS_TOKEN_EXPIRE_DAYS_REMEMBER = 30  # Duración con "Recordarme" activo: 30 días

# Contexto de hashing para contraseñas (SHA-256)
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    """Compara una contraseña en texto plano contra su versión hasheada."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """Genera el hash seguro de una contraseña para almacenarla en la BD."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Crea un token JWT firmado con los datos del usuario y una fecha de expiración."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    """Decodifica y valida un token JWT. Retorna None si es inválido o expiró."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
