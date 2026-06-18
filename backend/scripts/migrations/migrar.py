import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from sqlalchemy import text
from app.base_datos import engine


async def ejecutar():
    """Ejecuta migraciones SQL pendientes de forma secuencial."""
    migraciones = [
        # 1. Crear tabla clientes
        ("clientes", """
            CREATE TABLE IF NOT EXISTS clientes (
                id SERIAL PRIMARY KEY,
                razon_social VARCHAR(255) NOT NULL,
            identificacion_fiscal VARCHAR(100) NULL,
            email VARCHAR(255) NULL,
            telefono VARCHAR(50) NULL,
            contacto_nombre VARCHAR(255) NULL,
            activo BOOLEAN DEFAULT TRUE,
            fecha_creacion TIMESTAMP DEFAULT NOW(),
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id)
            )
        """),
        # 2. Crear tabla partidas
        ("partidas", """
            CREATE TABLE IF NOT EXISTS partidas (
                id SERIAL PRIMARY KEY,
                documento_id INTEGER NOT NULL REFERENCES documentos_procesados(id),
                descripcion VARCHAR(500) NULL,
                cantidad FLOAT NULL,
                precio_unitario FLOAT NULL,
                partida_sugerida VARCHAR(50) NULL,
                partida_corregida VARCHAR(50) NULL,
                orden INTEGER DEFAULT 0
            )
        """),
        # 3. Columnas nuevas en documentos_procesados
        ("flete", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS flete FLOAT NULL"),
        ("seguro", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS seguro FLOAT NULL"),
        ("otros", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS otros FLOAT NULL"),
        ("dua_generado", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS dua_generado BOOLEAN DEFAULT FALSE"),
        ("estado_aduanero", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS estado_aduanero VARCHAR(50) DEFAULT 'En Revision'"),
        ("fecha_presentacion", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS fecha_presentacion TIMESTAMP NULL"),
        ("fecha_aforo_documental", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS fecha_aforo_documental TIMESTAMP NULL"),
        ("fecha_aforo_fisico", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS fecha_aforo_fisico TIMESTAMP NULL"),
        ("fecha_liquidacion", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS fecha_liquidacion TIMESTAMP NULL"),
        ("fecha_liberacion", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS fecha_liberacion TIMESTAMP NULL"),
        ("ruta_archivo", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS ruta_archivo VARCHAR(512) NULL"),
        ("cliente_id", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS cliente_id INTEGER NULL REFERENCES clientes(id)"),
        # 4. Columnas faltantes en tabla clientes (creada antes de las migraciones)
        ("email_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL"),
        ("direccion_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion VARCHAR(500) NULL"),
        ("telefono_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefono VARCHAR(50) NULL"),
        ("contacto_nombre_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contacto_nombre VARCHAR(255) NULL"),
        ("activo_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE"),
        ("fecha_creacion_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMP DEFAULT NOW()"),
        ("usuario_id_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS usuario_id INTEGER NULL REFERENCES usuarios(id)"),
        # 5. hash_pdf para caché de extracciones repetidas
        ("hash_pdf", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS hash_pdf VARCHAR(64) NULL"),
        ("hash_pdf_idx", "CREATE INDEX IF NOT EXISTS ix_documentos_procesados_hash_pdf ON documentos_procesados(hash_pdf)"),
    ]

    for nombre, sql in migraciones:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(sql))
            print(f"  OK  {nombre}")
        except Exception as e:
            print(f"  ERR {nombre}: {e}")


if __name__ == "__main__":
    asyncio.run(ejecutar())
