"""
Migración: agrega columnas de estado aduanero a documentos_procesados.
Agrega estado_aduanero, fecha_presentacion y fecha_liberacion.
"""
import asyncio
from sqlalchemy import text
from app.base_datos import engine

async def migrar():
    async with engine.begin() as conn:
        try:
            await conn.execute(text(
                "ALTER TABLE documentos_procesados ADD COLUMN estado_aduanero VARCHAR(50) DEFAULT 'En Revision'"
            ))
            print("Columna estado_aduanero agregada correctamente.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("La columna estado_aduanero ya existe.")
            else:
                print(f"Error estado_aduanero: {e}")

        try:
            await conn.execute(text(
                "ALTER TABLE documentos_procesados ADD COLUMN fecha_presentacion TIMESTAMP"
            ))
            print("Columna fecha_presentacion agregada correctamente.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("La columna fecha_presentacion ya existe.")
            else:
                print(f"Error fecha_presentacion: {e}")

        try:
            await conn.execute(text(
                "ALTER TABLE documentos_procesados ADD COLUMN fecha_liberacion TIMESTAMP"
            ))
            print("Columna fecha_liberacion agregada correctamente.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("La columna fecha_liberacion ya existe.")
            else:
                print(f"Error fecha_liberacion: {e}")

if __name__ == "__main__":
    asyncio.run(migrar())
