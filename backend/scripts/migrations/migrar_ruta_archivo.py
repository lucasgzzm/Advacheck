import asyncio
from sqlalchemy import text
from app.base_datos import engine

async def migrar():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE documentos_procesados ADD COLUMN ruta_archivo VARCHAR(512)"))
            print("Columna ruta_archivo agregada correctamente.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("La columna ruta_archivo ya existe.")
            else:
                print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(migrar())
