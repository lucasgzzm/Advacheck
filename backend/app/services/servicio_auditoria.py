from sqlalchemy.ext.asyncio import AsyncSession
from ..modelos import Auditoria

async def registrar_auditoria(db: AsyncSession, usuario_id: int, accion: str, detalles: str) -> Auditoria:
    """Registra una acción de auditoría en la base de datos."""
    registro = Auditoria(
        accion=accion,
        detalles=detalles,
        usuario_id=usuario_id,
    )
    db.add(registro)
    # Importante: No hacemos db.commit() aquí para permitir que la transacción sea
    # confirmada junto con los cambios principales de la solicitud.
    return registro
