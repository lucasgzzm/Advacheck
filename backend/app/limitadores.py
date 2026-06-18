import time
from collections import defaultdict

# Limita la cantidad de intentos de inicio de sesion por ventana de tiempo
class LimitadorLogin:
    def __init__(self, max_intentos=5, ventana=300):
        self.max_intentos = max_intentos
        self.ventana = ventana
        self._intentos = defaultdict(list)

    # Verifica si la clave aun puede hacer intentos dentro del limite
    async def verificar(self, clave: str) -> bool:
        ahora = time.time()
        self._intentos[clave] = [t for t in self._intentos[clave] if ahora - t < self.ventana]
        return len(self._intentos[clave]) < self.max_intentos

    # Registra un intento de inicio de sesion para la clave dada
    async def registrar(self, clave: str):
        self._intentos[clave].append(time.time())

    # Reinicia los intentos registrados para una clave
    def resetear(self, clave: str):
        self._intentos.pop(clave, None)

limitador_login = LimitadorLogin()


# Controla la cantidad de documentos que un usuario puede procesar por hora
class LimitadorDocumentos:
    LIMITE = 20

    @staticmethod
    # Cuenta los documentos procesados por el usuario en la ultima hora
    async def contar_usados(db, usuario_id: int) -> dict:
        from datetime import datetime, timedelta, timezone
        from sqlalchemy import select, func, and_, asc
        from .modelos import DocumentoProcesado

        ahora = datetime.now(timezone.utc).replace(tzinfo=None)
        ventana = ahora - timedelta(hours=1)

        resultado = await db.execute(
            select(func.count())
            .select_from(DocumentoProcesado)
            .where(and_(
                DocumentoProcesado.usuario_id == usuario_id,
                DocumentoProcesado.fecha_analisis >= ventana
            ))
        )
        usados = resultado.scalar() or 0

        mas_antiguo = await db.execute(
            select(DocumentoProcesado.fecha_analisis)
            .where(and_(
                DocumentoProcesado.usuario_id == usuario_id,
                DocumentoProcesado.fecha_analisis >= ventana
            ))
            .order_by(asc(DocumentoProcesado.fecha_analisis))
            .limit(1)
        )
        fecha = mas_antiguo.scalar()
        proxima_recarga = (fecha + timedelta(hours=1)).isoformat() + "Z" if fecha else None

        return {
            "usados": usados,
            "limite": LimitadorDocumentos.LIMITE,
            "proxima_recarga": proxima_recarga,
        }


limitador_documentos = LimitadorDocumentos()
