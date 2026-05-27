import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.base_datos import engine


async def migrar():
    print("Agregando columnas de bloqueo a documentos_procesados...")
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE documentos_procesados
            ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS fecha_bloqueo TIMESTAMP,
            ADD COLUMN IF NOT EXISTS bloqueado_por_id INTEGER REFERENCES usuarios(id)
        """))
    print("Migración completada. Columnas 'bloqueado', 'fecha_bloqueo' y 'bloqueado_por_id' agregadas.")


if __name__ == "__main__":
    asyncio.run(migrar())
