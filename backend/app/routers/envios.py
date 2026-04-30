from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from .. import schemas, models
from ..database import get_db
from ..repositories import EnvioRepository

router = APIRouter(
    prefix="/api/envios",
    tags=["Envíos"]
)


@router.get("/", response_model=List[schemas.EnvioResponse])
async def obtener_envios(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    """Lista los envíos registrados en el sistema con paginación."""
    repo = EnvioRepository(db)
    envios = await repo.get_all(skip=skip, limit=limit)
    return envios


@router.post("/", response_model=schemas.EnvioResponse, status_code=status.HTTP_201_CREATED)
async def crear_envio(envio: schemas.EnvioCreate, db: AsyncSession = Depends(get_db)):
    """Crea un nuevo envío (cabecera de operación)."""
    nuevo_envio = models.Envio(
        referencia_operativa=envio.referencia_operativa,
        cliente_id=envio.cliente_id
    )
    
    db.add(nuevo_envio)
    await db.commit()
    await db.refresh(nuevo_envio)
    
    return nuevo_envio


@router.get("/{envio_id}", response_model=schemas.EnvioResponse)
async def obtener_envio_por_id(envio_id: int, db: AsyncSession = Depends(get_db)):
    """Obtiene un envío por su ID."""
    repo = EnvioRepository(db)
    envio = await repo.get_by_id(envio_id)
    if not envio:
        raise HTTPException(status_code=404, detail="El envío no existe o fue eliminado.")
    return envio
