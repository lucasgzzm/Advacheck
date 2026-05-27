import os
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path)

# En Render, DATABASE_URL se expone sin "+asyncpg". Se agrega si es necesario.
db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:admin@localhost:5432/webcheck_db")
if db_url and "+asyncpg" not in db_url and db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
DATABASE_URL = db_url

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    import warnings
    warnings.warn("SECRET_KEY no configurada — usando valor por defecto inseguro. Configúrala en producción.")
    SECRET_KEY = "webcheck_super_secret_key_change_me_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
ACCESS_TOKEN_EXPIRE_DAYS_REMEMBER = 30

API_BASE_URL = "http://127.0.0.1:8000"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
AZURE_OCR_ENDPOINT = os.getenv("AZURE_OCR_ENDPOINT")
AZURE_OCR_KEY = os.getenv("AZURE_OCR_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

MAX_FILE_SIZE_MB = 4
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
MAX_RPM = 15
SESSION_INACTIVITY_MINUTES = 15

HS_CODE_DEFAULT = "0000.00.00.00"
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
