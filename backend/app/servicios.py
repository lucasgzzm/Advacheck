from dataclasses import dataclass
from typing import List, Optional
from abc import ABC, abstractmethod
from decimal import Decimal
import logging

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio

from . import esquemas
from .modelos import NivelRiesgo, DocumentoProcesado, Observacion
from .catalogo_regulatorio import ENTIDADES_POR_PARTIDA, INCOTERMS_VALIDOS, normalizar_partida as _normalizar_partida

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
#  Estrategia: Motor de Reglas Aduaneras
# ──────────────────────────────────────────────

class ResultadoRegla(BaseModel):
    nombre_regla: str = Field(..., description="Nombre de la regla ejecutada")
    estado: str = Field(..., pattern=r"^(PASS|WARNING|FAIL)$")
    mensaje: str = Field(..., description="Mensaje descriptivo del resultado")
    requiere_aprobacion_admin: bool = Field(
        default=False,
        description="Indica si se requiere aprobación manual de un administrador",
    )
    detalle: Optional[dict] = Field(default=None, description="Detalles adicionales estructurados")


class ReglaBase(ABC):
    """Interfaz abstracta para todas las reglas aduaneras."""

    @abstractmethod
    async def validar(self, db: AsyncSession, data: dict) -> ResultadoRegla:
        """Ejecuta la validación contra los datos proporcionados."""
        ...




class ReglaValidacionIncoterm(ReglaBase):
    """
    Valida la consistencia del Incoterm declarado:
    - Verifica que el Incoterm sea uno de los reconocidos internacionalmente.
    - Si es FOB: flete y seguro no deben estar incluidos en el valor FOB,
      pero deben estar disponibles para el cálculo del CIF.
    - Si es CIF: flete y seguro son obligatorios.
    - Si es EXW: los gastos internos son responsabilidad del comprador.
    """

    async def validar(self, db: AsyncSession, data: dict) -> ResultadoRegla:
        incoterm = (data.get("incoterm") or "").strip().upper()
        monto_flete = float(data.get("monto_flete") or 0)
        monto_seguro = float(data.get("monto_seguro") or 0)
        monto_total = float(data.get("monto_total") or 0)
        detalles = data.get("detalles") or []

        if not incoterm:
            return ResultadoRegla(
                nombre_regla="ReglaValidacionIncoterm",
                estado="FAIL",
                mensaje="No se detectó un Incoterm en la factura.",
                requiere_aprobacion_admin=True,
            )

        if incoterm not in INCOTERMS_VALIDOS:
            return ResultadoRegla(
                nombre_regla="ReglaValidacionIncoterm",
                estado="FAIL",
                mensaje=f"Incoterm '{incoterm}' no reconocido en los usos de comercio internacional.",
                requiere_aprobacion_admin=True,
            )

        if incoterm == "FOB":
            if monto_flete > 0 or monto_seguro > 0:
                return ResultadoRegla(
                    nombre_regla="ReglaValidacionIncoterm",
                    estado="WARNING",
                    mensaje=(
                        "Incoterm FOB declarado con valores de flete y/o seguro "
                        "mayores a cero. Estos cargos no deberían estar en el valor FOB. "
                        "Verificar que el monto total no los incluya."
                    ),
                    requiere_aprobacion_admin=False,
                    detalle={
                        "monto_flete": monto_flete,
                        "monto_seguro": monto_seguro,
                        "sugerencia": "El flete y seguro deben declararse por separado "
                                      "para el cálculo del valor CIF.",
                    },
                )
            return ResultadoRegla(
                nombre_regla="ReglaValidacionIncoterm",
                estado="PASS",
                mensaje="Incoterm FOB válido. Flete y seguro sin cargos directos.",
            )

        if incoterm == "CIF":
            if monto_flete <= 0:
                return ResultadoRegla(
                    nombre_regla="ReglaValidacionIncoterm",
                    estado="FAIL",
                    mensaje="Incoterm CIF declarado, pero el monto de flete es cero o no fue proporcionado.",
                    requiere_aprobacion_admin=True,
                )
            if monto_seguro <= 0:
                return ResultadoRegla(
                    nombre_regla="ReglaValidacionIncoterm",
                    estado="FAIL",
                    mensaje="Incoterm CIF declarado, pero el monto de seguro es cero o no fue proporcionado.",
                    requiere_aprobacion_admin=True,
                )
            return ResultadoRegla(
                nombre_regla="ReglaValidacionIncoterm",
                estado="PASS",
                mensaje=f"Incoterm CIF válido con flete={monto_flete} y seguro={monto_seguro}.",
            )

        if incoterm == "EXW":
            if monto_flete > 0 or monto_seguro > 0:
                return ResultadoRegla(
                    nombre_regla="ReglaValidacionIncoterm",
                    estado="WARNING",
                    mensaje=(
                        "Incoterm EXW: los gastos de flete y seguro son "
                        "responsabilidad del comprador. Verificar que no estén "
                        "duplicados en la liquidación."
                    ),
                    requiere_aprobacion_admin=False,
                )
            return ResultadoRegla(
                nombre_regla="ReglaValidacionIncoterm",
                estado="PASS",
                mensaje="Incoterm EXW válido. Sin cargos de flete/seguro en la factura del vendedor.",
            )

        return ResultadoRegla(
            nombre_regla="ReglaValidacionIncoterm",
            estado="PASS",
            mensaje=f"Incoterm '{incoterm}' válido y consistente.",
        )





class ReglaVistoBuenoPorPartida(ReglaBase):
    """
    Cruza cada partida arancelaria de los detalles contra el catálogo
    de entidades regulatorias. Si la partida requiere permisos especiales
    y no se adjuntaron los documentos correspondientes, se emite WARNING o FAIL.
    """

    def __init__(self, documentos_adjuntos: Optional[List[str]] = None):
        self.documentos_adjuntos = set(d.upper() for d in (documentos_adjuntos or []))

    async def validar(self, db: AsyncSession, data: dict) -> ResultadoRegla:
        try:
            detalles = data.get("detalles") or []
            vistos_buenos_existentes = data.get("vistos_buenos_aprobados") or []

            if not detalles:
                return ResultadoRegla(
                    nombre_regla="ReglaVistoBuenoPorPartida",
                    estado="PASS",
                    mensaje="No hay detalles que validar contra entidades regulatorias.",
                )

            entidades_requeridas: dict = {}
            items_sin_partida = 0

            for idx, item in enumerate(detalles):
                partida = item.get("partida_arancelaria_corregida") or item.get("partida_arancelaria") or ""
                if not partida or partida.strip() in ("", "0000.00.00.00"):
                    items_sin_partida += 1
                    continue

                codigo = _normalizar_partida(partida)
                for regla in ENTIDADES_POR_PARTIDA:
                    if regla["rango_desde"] <= codigo <= regla["rango_hasta"]:
                        clave = (regla["entidad"], regla["tipo"])
                        if clave not in entidades_requeridas:
                            entidades_requeridas[clave] = {
                                "entidad": regla["entidad"],
                                "tipo_permiso": regla["tipo"],
                                "partidas_relacionadas": set(),
                            }
                        entidades_requeridas[clave]["partidas_relacionadas"].add(partida)

            if items_sin_partida == len(detalles):
                return ResultadoRegla(
                    nombre_regla="ReglaVistoBuenoPorPartida",
                    estado="WARNING",
                    mensaje="Ningún detalle tiene una partida arancelaria asignada. "
                            "No es posible determinar requisitos regulatorios.",
                    requiere_aprobacion_admin=False,
                )

            if not entidades_requeridas:
                return ResultadoRegla(
                    nombre_regla="ReglaVistoBuenoPorPartida",
                    estado="PASS",
                    mensaje="Ninguna partida arancelaria requiere permisos regulatorios especiales.",
                )

            permisos_faltantes = [
                e for e in entidades_requeridas.values()
                if e["entidad"] not in vistos_buenos_existentes
            ]

            if not permisos_faltantes:
                return ResultadoRegla(
                    nombre_regla="ReglaVistoBuenoPorPartida",
                    estado="PASS",
                    mensaje=f"Todos los V°B° regulatorios están cubiertos "
                            f"({len(entidades_requeridas)} entidades).",
                )

            totales = {e["entidad"]: len([p for p in permisos_faltantes if p["entidad"] == e["entidad"]])
                       for e in permisos_faltantes}
            entidades_str = ", ".join(
                f"{e['entidad']} ({e['tipo_permiso']})"
                for e in permisos_faltantes[:5]
            )
            if len(permisos_faltantes) > 5:
                entidades_str += f" y {len(permisos_faltantes) - 5} más"

            return ResultadoRegla(
                nombre_regla="ReglaVistoBuenoPorPartida",
                estado="FAIL" if len(permisos_faltantes) > 2 else "WARNING",
                mensaje=(
                    f"Se requieren {len(permisos_faltantes)} permiso(s) regulatorio(s) "
                    f"no aprobados: {entidades_str}. "
                    "Gestionar los V°B° correspondientes antes del despacho."
                ),
                requiere_aprobacion_admin=(len(permisos_faltantes) > 2),
                detalle={
                    "permisos_faltantes": permisos_faltantes,
                    "entidades_afectadas": list(totales.keys()),
                },
            )

        except Exception as exc:
            logger.exception("Error en ReglaVistoBuenoPorPartida")
            return ResultadoRegla(
                nombre_regla="ReglaVistoBuenoPorPartida",
                estado="WARNING",
                mensaje=f"Error interno al evaluar requisitos regulatorios: {exc}",
                requiere_aprobacion_admin=False,
            )


class ReglaCuadreAritmeticoCIF(ReglaBase):
    """
    Verifica el cuadre aritmético aduanero:
        Valor FOB + Flete + Seguro = Valor CIF
    Aplica un margen de tolerancia de 2 unidades monetarias
    para absorber diferencias por redondeo.
    """

    TOLERANCIA = Decimal("2.00")

    async def validar(self, db: AsyncSession, data: dict) -> ResultadoRegla:
        try:
            monto_subtotal = Decimal(str(data.get("monto_subtotal") or 0))
            monto_flete = Decimal(str(data.get("monto_flete") or 0))
            monto_seguro = Decimal(str(data.get("monto_seguro") or 0))
            monto_otros = Decimal(str(data.get("monto_otros_gastos") or 0))
            monto_total = Decimal(str(data.get("monto_total") or 0))
            moneda = data.get("moneda") or "USD"

            if monto_total <= 0:
                return ResultadoRegla(
                    nombre_regla="ReglaCuadreAritmeticoCIF",
                    estado="FAIL",
                    mensaje="El monto total de la factura es cero o negativo. Imposible verificar cuadre.",
                    requiere_aprobacion_admin=True,
                )

            monto_calculado = monto_subtotal + monto_flete + monto_seguro + monto_otros
            diferencia = abs(monto_calculado - monto_total)

            if diferencia <= self.TOLERANCIA:
                return ResultadoRegla(
                    nombre_regla="ReglaCuadreAritmeticoCIF",
                    estado="PASS",
                    mensaje=(
                        f"Cuadre aritmético correcto: "
                        f"{monto_subtotal} (Subtotal) + {monto_flete} (Flete) + "
                        f"{monto_seguro} (Seguro) + {monto_otros} (Otros) = "
                        f"{monto_calculado} ≈ {monto_total} {moneda}"
                    ),
                    detalle={
                        "monto_subtotal": float(monto_subtotal),
                        "monto_flete": float(monto_flete),
                        "monto_seguro": float(monto_seguro),
                        "monto_otros_gastos": float(monto_otros),
                        "monto_calculado": float(monto_calculado),
                        "monto_total": float(monto_total),
                        "diferencia": float(diferencia),
                        "moneda": moneda,
                    },
                )

            return ResultadoRegla(
                nombre_regla="ReglaCuadreAritmeticoCIF",
                estado="FAIL",
                mensaje=(
                    f"Discrepancia aritmética en el valor aduanero: "
                    f"Subtotal ({monto_subtotal}) + Flete ({monto_flete}) + "
                    f"Seguro ({monto_seguro}) + Otros ({monto_otros}) = "
                    f"{monto_calculado}, pero el Total declarado es {monto_total} {moneda}. "
                    f"Diferencia: {diferencia} {moneda} (tolerancia: {self.TOLERANCIA} {moneda})."
                ),
                requiere_aprobacion_admin=True,
                detalle={
                    "monto_subtotal": float(monto_subtotal),
                    "monto_flete": float(monto_flete),
                    "monto_seguro": float(monto_seguro),
                    "monto_otros_gastos": float(monto_otros),
                    "monto_calculado": float(monto_calculado),
                    "monto_total": float(monto_total),
                    "diferencia": float(diferencia),
                    "moneda": moneda,
                },
            )

        except Exception as exc:
            logger.exception("Error en ReglaCuadreAritmeticoCIF")
            return ResultadoRegla(
                nombre_regla="ReglaCuadreAritmeticoCIF",
                estado="WARNING",
                mensaje=f"Error interno al verificar cuadre aritmético: {exc}",
                requiere_aprobacion_admin=False,
            )


class MotorReglasAduaneras:
    """
    Coordinador del motor de reglas aduaneras.

    Recibe el payload estructurado (proveniente de la IA), ejecuta todas las
    reglas registradas de forma concurrente y persiste los resultados en las
    tablas `documentos_procesados` y `observaciones`.
    """

    def __init__(self):
        self._reglas: List[ReglaBase] = []

    def registrar_regla(self, regla: ReglaBase) -> None:
        self._reglas.append(regla)

    def registrar_reglas(self, *reglas: ReglaBase) -> None:
        self._reglas.extend(reglas)

    async def ejecutar_todas(self, db: AsyncSession, data: dict) -> List[ResultadoRegla]:
        """
        Ejecuta todas las reglas registradas en paralelo.

        Args:
            db: Sesión de base de datos asíncrona.
            data: Diccionario con la información estructurada de la factura
                  y sus detalles.

        Returns:
            Lista de resultados (ResultadoRegla) de cada regla ejecutada.
        """
        tareas = [regla.validar(db, data) for regla in self._reglas]
        resultados = await asyncio.gather(*tareas, return_exceptions=True)

        resultados_finales: List[ResultadoRegla] = []
        for i, resultado in enumerate(resultados):
            if isinstance(resultado, Exception):
                logger.error(
                    "Regla %s lanzó una excepción: %s",
                    type(self._reglas[i]).__name__,
                    resultado,
                )
                resultados_finales.append(
                    ResultadoRegla(
                        nombre_regla=type(self._reglas[i]).__name__,
                        estado="WARNING",
                        mensaje=f"Error en ejecución: {resultado}",
                        requiere_aprobacion_admin=False,
                    )
                )
            else:
                resultados_finales.append(resultado)

        return resultados_finales

    async def ejecutar_y_persistir(
        self,
        db: AsyncSession,
        data: dict,
        usuario_id: int,
        documento_id: Optional[int] = None,
    ) -> dict:
        """
        Ejecuta todas las reglas y persiste los resultados.

        Crea o actualiza un registro en `documentos_procesados` y genera
        observaciones para cada regla que no haya pasado (WARNING/FAIL).

        Args:
            db: Sesión de base de datos asíncrona.
            data: Payload estructurado con datos de la factura.
            usuario_id: ID del usuario que ejecuta la validación.
            documento_id: ID opcional de un documento_procesado existente.

        Returns:
            Diccionario con el resumen de la ejecución.
        """
        resultados = await self.ejecutar_todas(db, data)

        # Determinar nivel de riesgo global
        estados = [r.estado for r in resultados]
        requiere_admin = any(r.requiere_aprobacion_admin for r in resultados)

        if "FAIL" in estados:
            riesgo_global = NivelRiesgo.ALTO.value
        elif "WARNING" in estados:
            riesgo_global = NivelRiesgo.MEDIO.value
        else:
            riesgo_global = NivelRiesgo.BAJO.value

        # Persistir / actualizar documento_procesado
        if documento_id:
            resultado_db = await db.get(DocumentoProcesado, documento_id)
            if resultado_db:
                resultado_db.riesgo = riesgo_global
                resultado_db.estado = "Pendiente Aprobación" if requiere_admin else "Validado"
        else:
            resultado_db = DocumentoProcesado(
                nombre_archivo=data.get("nombre_archivo", "Validación automática"),
                proveedor=data.get("proveedor"),
                cliente=data.get("cliente"),
                total_cif=data.get("monto_total"),
                riesgo=riesgo_global,
                estado="Pendiente Aprobación" if requiere_admin else "Validado",
                usuario_id=usuario_id,
            )
            db.add(resultado_db)

        await db.flush()

        # Persistir observaciones para cada regla no-PASS
        for resultado in resultados:
            if resultado.estado == "PASS":
                continue

            tipo_obs = "alerta" if resultado.estado == "WARNING" else "correccion"
            obs = Observacion(
                contenido=(
                    f"[{resultado.nombre_regla}] {resultado.estado}: "
                    f"{resultado.mensaje}"
                ),
                tipo=tipo_obs,
                documento_id=resultado_db.id,
                usuario_id=usuario_id,
            )
            db.add(obs)

        await db.commit()
        await db.refresh(resultado_db)

        return {
            "documento_id": resultado_db.id,
            "riesgo_global": riesgo_global,
            "estado": resultado_db.estado,
            "requiere_aprobacion_admin": requiere_admin,
            "total_reglas": len(resultados),
            "resultados": [r.model_dump() for r in resultados],
        }


