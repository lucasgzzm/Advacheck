import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy import text
from .base_datos import engine, Base
from . import modelos
from .routers import facturas, autenticacion, administracion, documentos, catalogo, regulatorio, clientes
from .configuracion import CORS_ORIGINS

# Creamos la aplicacion FastAPI con nombre y version
app = FastAPI(
    title="WebCheck - Prevalidación Aduanera",
    description="API para la extracción, evaluación y gestión de facturas de importación.",
    version="1.0.0",
)

# Configuracion de CORS: permitimos que el frontend (en otro puerto) pueda llamar a la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registramos todos los routers de la API
app.include_router(facturas.router)
app.include_router(autenticacion.router)
app.include_router(administracion.router)
app.include_router(documentos.router)
app.include_router(catalogo.router)
app.include_router(regulatorio.router)
app.include_router(clientes.router)


# Si existe la carpeta estatico (build del frontend), la servimos como archivos estaticos
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "estatico")
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")

# Apenas arranca el servidor, crea las tablas en la base de datos si no existen
@app.on_event("startup")
async def iniciar():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Migra las columnas nuevas para bases de datos existentes
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
                await conn.execute(text(sql))
    except Exception as e:
        print(f"Advertencia en el arranque: {str(e)}")


# Endpoint simple para verificar que el servidor esta vivo
@app.get("/", tags=["Estado"])
async def raiz():
    return {
        "estado": "operativo",
        "mensaje": "El servidor de WebCheck se encuentra activo.",
    }
