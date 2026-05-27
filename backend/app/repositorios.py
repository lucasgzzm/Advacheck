from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from typing import Type, TypeVar, Generic, List, Optional
from .base_datos import Base
from .modelos import Envio, Factura, FacturaDetalle

ModelType = TypeVar("ModelType", bound=Base)


class RepositorioBase(Generic[ModelType]):
    """
    Repositorio genérico que encapsula las operaciones básicas de base de datos
    (obtener por ID, listar todos, agregar) para cualquier modelo ORM.
    """
    def __init__(self, model: Type[ModelType], db_session: AsyncSession):
        self.model = model
        self.db = db_session

    async def obtener_por_id(self, id: int) -> Optional[ModelType]:
        """Obtiene un registro por su ID."""
        result = await self.db.execute(select(self.model).filter(self.model.id == id))
        return result.scalars().first()

    async def obtener_todos(self, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """Lista registros con paginación."""
        result = await self.db.execute(select(self.model).offset(skip).limit(limit))
        return result.scalars().all()

    async def agregar(self, entity: ModelType) -> ModelType:
        """Agrega un nuevo registro a la sesión y obtiene su ID generado."""
        self.db.add(entity)
        await self.db.flush()
        await self.db.refresh(entity)
        return entity


class EnvioRepository(RepositorioBase[Envio]):
    def __init__(self, db_session: AsyncSession):
        super().__init__(Envio, db_session)

class FacturaRepository(RepositorioBase[Factura]):
    def __init__(self, db_session: AsyncSession):
        super().__init__(Factura, db_session)

class FacturaDetalleRepository(RepositorioBase[FacturaDetalle]):
    def __init__(self, db_session: AsyncSession):
        super().__init__(FacturaDetalle, db_session)

