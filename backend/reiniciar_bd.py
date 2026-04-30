import asyncio
import sys
import os

sys.path.append(os.getcwd())

from sqlalchemy import text
from app.base_datos import engine, Base
from app.modelos import Rol, Usuario
from app.seguridad import get_password_hash


async def reset_database():
    """Elimina todas las tablas, las recrea y agrega los datos iniciales."""
    print("Iniciando reinicio de la base de datos (webcheck_db)...")
    
    async with engine.begin() as conn:
        # Eliminar tablas existentes
        print("Eliminando tablas...")
        await conn.execute(text("DROP TABLE IF EXISTS factura_detalles CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS facturas CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS envios CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS clientes CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS auditoria CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS documentos_procesados CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS usuarios CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS roles CASCADE"))
        
        # Recrear tablas desde los modelos Python
        print("Recreando tablas...")
        await conn.run_sync(Base.metadata.create_all)
        
        # Insertar datos iniciales
        print("Insertando datos iniciales...")
        await conn.execute(text("INSERT INTO roles (nombre, descripcion) VALUES ('Administrador', 'Acceso total'), ('Agente', 'Carga y validacion')"))
        
        res = await conn.execute(text("SELECT id FROM roles WHERE nombre = 'Administrador'"))
        admin_rol_id = res.scalar()
        
        admin_email = "admin@webcheck.com"
        admin_pass = "admin123"
        hashed = get_password_hash(admin_pass)
        
        await conn.execute(text("""
            INSERT INTO usuarios (nombre, email, hashed_password, rol_id, activo)
            VALUES ('Admin WebCheck', :email, :password, :rol_id, true)
        """), {"email": admin_email, "password": hashed, "rol_id": admin_rol_id})
        
        print("")
        print("=" * 50)
        print("Base de datos reiniciada correctamente.")
        print(f"Usuario: {admin_email}")
        print(f"Password: {admin_pass}")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(reset_database())
