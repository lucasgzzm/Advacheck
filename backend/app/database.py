from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

# Cadena de conexión a PostgreSQL
SQLALCHEMY_DATABASE_URL = "postgresql+asyncpg://postgres:admin@localhost:5432/webcheck_db"

# Motor asíncrono de SQLAlchemy para ejecutar consultas contra la BD
engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL, 
    echo=False,  # Cambiar a True para depurar consultas SQL en consola
    future=True
)

# Fábrica de sesiones asíncronas (cada petición HTTP obtiene su propia sesión)
AsyncSessionLocal = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Clase base declarativa de la que heredan todos los modelos ORM
Base = declarative_base()
metadata = Base.metadata

# Función generadora que inyecta una sesión de BD en cada endpoint que la necesite
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
