import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy import text, select
from .base_datos import engine, Base, AsyncSessionLocal
from . import modelos
from .seguridad import generar_hash
from .rutas import facturas, autenticacion, administracion, documentos, catalogo, regulatorio
from .configuracion import CORS_ORIGINS

logger = logging.getLogger(__name__)

app = FastAPI(
    title="WebCheck - Prevalidación Aduanera",
    description="API para la extracción, evaluación y gestión de facturas de importación.",
    version="1.0.0",
)

usa_wildcard = any(o.strip() == "*" for o in CORS_ORIGINS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if not usa_wildcard else ["*"],
    allow_credentials=not usa_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(facturas.router)
app.include_router(autenticacion.router)
app.include_router(administracion.router)
app.include_router(documentos.router)
app.include_router(catalogo.router)
app.include_router(regulatorio.router)

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "estatico")
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")

# Crea las tablas y ejecuta migraciones al arrancar el servidor
@app.on_event("startup")
async def iniciar():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        columnas_nuevas = [
            ("fecha_emision", "VARCHAR(50)"),
            ("moneda", "VARCHAR(10)"),
            ("monto_subtotal", "FLOAT"),
            ("remitente_dir", "VARCHAR(500)"),
            ("remitente_doc", "VARCHAR(100)"),
            ("destinatario_dir", "VARCHAR(500)"),
            ("transporte_pais", "VARCHAR(100)"),
            ("transporte_metodo", "VARCHAR(100)"),
            ("peso_bruto", "FLOAT"),
            ("peso_neto", "FLOAT"),
            ("receptor_tax", "VARCHAR(100)"),
            ("datos_originales", "JSON"),
            ("numero_factura", "VARCHAR(100)"),
            ("incoterm", "VARCHAR(10)"),
            ("pais_origen", "VARCHAR(100)"),
            ("prevalidacion_resultado", "JSON"),
        ]
        for col_name, col_type in columnas_nuevas:
            sql = f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='documentos_procesados' AND column_name='{col_name}'
                    ) THEN
                        ALTER TABLE documentos_procesados ADD COLUMN {col_name} {col_type};
                    END IF;
                END $$;
            """
            try:
                await conn.execute(text(sql))
            except Exception as e:
                logger.warning("No se pudo aplicar migracion columna %s: %s", col_name, str(e))

    # Crea el admin por defecto si no existe ningun usuario administrador
    async with AsyncSessionLocal() as db:
        resultado = await db.execute(
            select(modelos.Rol).filter(modelos.Rol.nombre == "Administrador")
        )
        rol = resultado.scalars().first()
        if not rol:
            rol = modelos.Rol(nombre="Administrador", descripcion="Acceso total al sistema")
            db.add(rol)
            await db.flush()
            logger.info("Rol 'Administrador' creado automaticamente.")

        resultado = await db.execute(
            select(modelos.Usuario).filter(modelos.Usuario.email == "admin@webcheck.com")
        )
        if not resultado.scalars().first():
            usuario = modelos.Usuario(
                nombre="Administrador",
                email="admin@webcheck.com",
                contrasena_hash=generar_hash("admin123"),
                activo=True,
                rol_id=rol.id,
            )
            db.add(usuario)
            await db.commit()
            logger.info("Usuario admin creado: admin@webcheck.com")
        else:
            logger.info("Usuario admin ya existe, se omite creacion.")

# Endpoint de salud que verifica que el servidor esta operativo
@app.get("/", tags=["Estado"])
async def raiz():
    return {
        "estado": "operativo",
        "mensaje": "El servidor de WebCheck se encuentra activo.",
    }
