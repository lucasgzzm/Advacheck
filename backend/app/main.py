from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from . import models
from .routers import envios, facturas, auth, admin

# Inicialización de la aplicación FastAPI
app = FastAPI(
    title="WebCheck - Prevalidación Aduanera",
    description="API para la extracción, evaluación y gestión de facturas de importación.",
    version="1.0.0"
)

# Configuración de CORS para permitir la comunicación con el frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de los módulos de rutas
app.include_router(envios.router)
app.include_router(facturas.router)
app.include_router(auth.router)
app.include_router(admin.router)

# Al iniciar el servidor, se crean las tablas que no existan aún en la BD
@app.on_event("startup")
async def startup_event():
    try:
        async with engine.begin() as conn:
             await conn.run_sync(Base.metadata.create_all)
             print("Base de datos sincronizada correctamente.")
    except Exception as e:
        print(f"Advertencia en el arranque: {str(e)}")

# Endpoint de verificación de estado del servidor
@app.get("/", tags=["Estado"])
async def root():
    return {
        "estado": "operativo",
        "mensaje": "El servidor de WebCheck se encuentra activo."
    }
