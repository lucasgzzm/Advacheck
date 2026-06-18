import os
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path)

db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:admin@localhost:5432/webcheck_db")
if db_url and "+asyncpg" not in db_url and db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
DATABASE_URL = db_url

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if os.getenv("RENDER") or os.getenv("PRODUCTION"):
        raise RuntimeError(
            "SECRET_KEY no configurada. "
            "Debes definirla en las variables de entorno (producción)."
        )
    import secrets
    import logging
    logging.warning(
        "SECRET_KEY no configurada en .env — usando clave aleatoria temporal. "
        "Los tokens existentes se invalidarán al reiniciar el servidor."
    )
    SECRET_KEY = secrets.token_hex(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
ACCESS_TOKEN_EXPIRE_DAYS_REMEMBER = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

AZURE_OCR_ENDPOINT = os.getenv("AZURE_OCR_ENDPOINT")
AZURE_OCR_KEY = os.getenv("AZURE_OCR_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

_EN_PROD = os.getenv("RENDER") or os.getenv("PRODUCTION")
if _EN_PROD:
    if not GEMINI_API_KEY:
        import logging
        logging.warning(
            "GEMINI_API_KEY no configurada en producción. "
            "La extracción de datos con IA fallará. Configúrala en las variables de entorno."
        )
    if not AZURE_OCR_ENDPOINT or not AZURE_OCR_KEY:
        import logging
        logging.warning(
            "Azure OCR no configurado en producción. "
            "El sistema usará OCR local (pdfplumber) que puede ser menos preciso."
        )

GEMINI_MAX_RPM = int(os.getenv("GEMINI_MAX_RPM", "8"))
GEMINI_MIN_INTERVAL = float(os.getenv("GEMINI_MIN_INTERVAL", "7.0"))

SESSION_INACTIVITY_MINUTES = 15
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cargas")

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp-relay.brevo.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "jlrec0214@gmail.com")
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
