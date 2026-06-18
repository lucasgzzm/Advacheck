from sqlalchemy.ext.asyncio import AsyncSession
from ..modelos import Auditoria

# Registra una accion de auditoria en la base de datos
async def registrar_auditoria(db: AsyncSession, usuario_id: int, accion: str, detalles: str) -> Auditoria:
    registro = Auditoria(
        accion=accion,
        detalles=detalles,
        usuario_id=usuario_id,
    )
    db.add(registro)
    return registro
