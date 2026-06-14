from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from .configuracion import DATABASE_URL

# Motor de base de datos asincrono (usamos asyncpg para PostgreSQL)
engine = create_async_engine(DATABASE_URL, echo=False)

# Fabrica de sesiones: cada vez que necesitamos hablar con la BD pedimos una sesion aca
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Base para todos los modelos SQLAlchemy, de aca heredan las tablas
Base = declarative_base()


# Generador que se usa con Dependency Injection de FastAPI
# Cada request abre una sesion, la usa y la cierra al terminar
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
