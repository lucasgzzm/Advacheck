import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from passlib.context import CryptContext

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/webcheck",
)

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class Rol(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False)
    descripcion = Column(String(200), nullable=True)


class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    contrasena_hash = Column("hashed_password", String(255), nullable=False)
    activo = Column("is_active", Boolean, default=True)
    rol_id = Column(Integer, ForeignKey("roles.id"))


async def seed():
    async with AsyncSessionLocal() as db:
        resultado = await db.execute(select(Rol).filter(Rol.nombre == "Administrador"))
        rol = resultado.scalars().first()
        if not rol:
            rol = Rol(nombre="Administrador", descripcion="Acceso total al sistema")
            db.add(rol)
            await db.flush()
            print("Rol 'Administrador' creado.")
        else:
            print("Rol 'Administrador' ya existe.")

        resultado = await db.execute(select(Usuario).filter(Usuario.email == "admin@webcheck.com"))
        if resultado.scalars().first():
            print("El usuario admin@webcheck.com ya existe.")
            return

        usuario = Usuario(
            nombre="Administrador",
            email="admin@webcheck.com",
            contrasena_hash=pwd_context.hash("admin123"),
            activo=True,
            rol_id=rol.id,
        )
        db.add(usuario)
        await db.commit()
        print("Usuario admin creado: admin@webcheck.com / admin123")


asyncio.run(seed())
