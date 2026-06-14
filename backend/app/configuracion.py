import os
from dotenv import load_dotenv

# Cargamos variables del archivo .env que esta en la raiz del backend
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path)

# Conexion a PostgreSQL: si la URL no trae "+asyncpg" se lo agregamos automaticamente
db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:admin@localhost:5432/webcheck_db")
if db_url and "+asyncpg" not in db_url and db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
DATABASE_URL = db_url

# Llave secreta para firmar tokens JWT. En produccion debe configurarse obligatoriamente
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if os.getenv("RENDER") or os.getenv("PRODUCTION"):
        raise RuntimeError(
            "SECRET_KEY no configurada. "
            "Debes definirla en las variables de entorno (producción)."
        )
    import warnings
    warnings.warn("SECRET_KEY no configurada — usando valor por defecto inseguro. Configúrala en producción.")
    SECRET_KEY = "webcheck_super_secret_key_change_me_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
ACCESS_TOKEN_EXPIRE_DAYS_REMEMBER = 30

# Credenciales para los servicios externos de IA
AZURE_OCR_ENDPOINT = os.getenv("AZURE_OCR_ENDPOINT")
AZURE_OCR_KEY = os.getenv("AZURE_OCR_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Limite de requests por minuto a la API de Gemini (Free tier: 10 RPM)
# Ajustar segun el plan contratado o si se cambia de proveedor de IA
GEMINI_MAX_RPM = int(os.getenv("GEMINI_MAX_RPM", "8"))
# Intervalo minimo en segundos entre requests consecutivas a Gemini
GEMINI_MIN_INTERVAL = float(os.getenv("GEMINI_MIN_INTERVAL", "7.0"))

# Configuracion de sesion y CORS
SESSION_INACTIVITY_MINUTES = 15
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

# Directorio donde se guardan los PDFs subidos
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cargas")

# Configuracion SMTP para envio de correos (aclaraciones, notificaciones)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")
