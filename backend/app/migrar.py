import asyncio
from sqlalchemy import text
from .base_datos import engine


async def ejecutar():
    """Ejecuta migraciones SQL pendientes de forma secuencial."""
    migraciones = [
        # 1. Crear tabla despachantes
        ("despachantes", """
            CREATE TABLE IF NOT EXISTS despachantes (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                rut VARCHAR(50) NULL,
                telefono VARCHAR(50) NULL,
                email VARCHAR(255) NULL,
                direccion VARCHAR(500) NULL,
                activo BOOLEAN DEFAULT TRUE,
                fecha_creacion TIMESTAMP DEFAULT NOW()
            )
        """),
        # 2. Crear tabla clientes
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
        # 3. Crear tabla garantias
        ("garantias", """
            CREATE TABLE IF NOT EXISTS garantias (
                id SERIAL PRIMARY KEY,
                tipo VARCHAR(50) NOT NULL,
                numero VARCHAR(100) NOT NULL,
                monto FLOAT NOT NULL,
                moneda VARCHAR(10) DEFAULT 'USD',
                fecha_emision TIMESTAMP NULL,
                fecha_vencimiento TIMESTAMP NULL,
                estado VARCHAR(50) DEFAULT 'Vigente',
                emisor VARCHAR(255) NULL,
                observaciones VARCHAR(1000) NULL,
                fecha_creacion TIMESTAMP DEFAULT NOW(),
                documento_id INTEGER NOT NULL REFERENCES documentos_procesados(id)
            )
        """),
        # 4. Crear tabla partidas
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
        # 5. Crear tabla notificaciones
        ("notificaciones", """
            CREATE TABLE IF NOT EXISTS notificaciones (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL,
                mensaje TEXT NULL,
                tipo VARCHAR(50) DEFAULT 'info',
                leida BOOLEAN DEFAULT FALSE,
                fecha_creacion TIMESTAMP DEFAULT NOW(),
                documento_id INTEGER NULL REFERENCES documentos_procesados(id),
                usuario_destino_id INTEGER NOT NULL REFERENCES usuarios(id),
                usuario_origen_id INTEGER NULL REFERENCES usuarios(id)
            )
        """),
        # 6. Columnas nuevas en documentos_procesados
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
        ("despachante_id", "ALTER TABLE documentos_procesados ADD COLUMN IF NOT EXISTS despachante_id INTEGER NULL REFERENCES despachantes(id)"),
        # 7. Columnas faltantes en tabla clientes (creada antes de las migraciones)
        ("email_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL"),
        ("direccion_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion VARCHAR(500) NULL"),
        ("telefono_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefono VARCHAR(50) NULL"),
        ("contacto_nombre_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contacto_nombre VARCHAR(255) NULL"),
        ("activo_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE"),
        ("fecha_creacion_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMP DEFAULT NOW()"),
        ("usuario_id_clientes", "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS usuario_id INTEGER NULL REFERENCES usuarios(id)"),
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
