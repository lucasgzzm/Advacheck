from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from .configuracion import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, ACCESS_TOKEN_EXPIRE_DAYS_REMEMBER

# Contexto de passlib para hashear contraseñas con bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verificar_contrasena(contrasena_plana: str, hash_guardado: str) -> bool:
    """Compara una contraseña escrita por el usuario contra el hash guardado en BD."""
    return pwd_context.verify(contrasena_plana, hash_guardado)


def hashear_contrasena(contrasena: str) -> str:
    """Convierte una contraseña en texto plano a su hash bcrypt."""
    return pwd_context.hash(contrasena)


def crear_token(datos: dict, expiracion: timedelta) -> str:
    """Genera un token JWT con los datos del usuario.

    Toma un timedelta que indica cuanto tiempo hasta que venza
    (tipicamente 60 minutos o 30 dias si marco "recordarme").
    """
    payload = datos.copy()
    payload["exp"] = datetime.utcnow() + expiracion
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verificar_token(token: str) -> Optional[dict]:
    """Decodifica un token JWT y devuelve su contenido.
    Si el token es invalido o expiro, retorna None.
    """
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# Alias para compatibilidad con nombres anteriores
verificar_password = verificar_contrasena
generar_hash = hashear_contrasena
crear_token_acceso = crear_token
decodificar_token = verificar_token
obtener_expiracion = lambda remember: (
    timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS_REMEMBER) if remember
    else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
)
