from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .base_datos import engine, Base
from . import modelos
from .routers import facturas, autenticacion, administracion, documentos, catalogo, regulatorio, garantias, despachantes, clientes
from .config import CORS_ORIGINS

app = FastAPI(
    title="WebCheck - Prevalidación Aduanera",
    description="API para la extracción, evaluación y gestión de facturas de importación.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(facturas.router)
app.include_router(autenticacion.router)
app.include_router(administracion.router)
app.include_router(documentos.router)
app.include_router(catalogo.router)
app.include_router(regulatorio.router)
app.include_router(garantias.router)
app.include_router(despachantes.router)
app.include_router(clientes.router)


@app.on_event("startup")
async def iniciar():
    """Inicializa las tablas de la base de datos al arrancar la aplicación."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        print(f"Advertencia en el arranque: {str(e)}")


@app.get("/", tags=["Estado"])
async def raiz():
    """Endpoint de verificación de estado del servidor."""
    return {
        "estado": "operativo",
        "mensaje": "El servidor de WebCheck se encuentra activo.",
    }
