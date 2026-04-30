import asyncio
from sqlalchemy import text
from app.database import engine
from app.auth_utils import get_password_hash


async def seed():
    """Inserta los roles y el usuario administrador inicial si no existen."""
    async with engine.begin() as conn:
        print("Insertando roles...")
        await conn.execute(text("""
            INSERT INTO roles (nombre, descripcion) 
            VALUES ('Administrador', 'Acceso total'), ('Agente', 'Carga y validacion')
            ON CONFLICT (nombre) DO NOTHING;
        """))
        
        res = await conn.execute(text("SELECT id FROM roles WHERE nombre = 'Administrador'"))
        admin_rol_id = res.scalar()
        
        print(f"Insertando usuario administrador con rol_id {admin_rol_id}...")
        admin_email = "admin@webcheck.com"
        admin_pass = get_password_hash("admin123")
        
        await conn.execute(text("""
            INSERT INTO usuarios (nombre, email, hashed_password, rol_id, activo)
            VALUES ('Administrador WebCheck', :email, :password, :rol_id, true)
            ON CONFLICT (email) DO NOTHING;
        """), {"email": admin_email, "password": admin_pass, "rol_id": admin_rol_id})
        
        print(f"Completado. Usuario: {admin_email} / admin123")


if __name__ == "__main__":
    asyncio.run(seed())
