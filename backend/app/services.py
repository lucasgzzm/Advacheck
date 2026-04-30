from dataclasses import dataclass
from typing import List
from . import schemas
from .models import NivelRiesgo


@dataclass
class RiesgoEvaluacion:
    """Resultado de la evaluación de riesgo de un ítem o factura completa."""
    inconsistente: bool
    sugerencia_partida: str
    observaciones: str
    nivel_riesgo_general: str


class SistemaReglasAduaneras:
    """
    Motor de reglas para la pre-validación de documentos aduaneros.
    Evalúa cada ítem y la factura completa para asignar un nivel de riesgo
    y sugerir partidas arancelarias según el tipo de producto.
    """

    @staticmethod
    def _limpiar_texto(texto: str) -> str:
         return texto.lower().strip()

    @classmethod
    def evaluar_item(cls, item: schemas.FacturaDetalleCreate) -> RiesgoEvaluacion:
        """
        Evalúa un ítem individual:
        - Verifica que el precio y la cantidad sean válidos.
        - Sugiere una partida arancelaria según palabras clave del producto.
        """
        inconsistente = False
        observaciones_item = []
        descripcion = cls._limpiar_texto(item.descripcion_producto)
        
        # Asignación de partida arancelaria por palabras clave
        partida = None
        if "zapat" in descripcion or "zapatilla" in descripcion or "zapatos" in descripcion:
            partida = "6403.99.90.00"
        elif "laptop" in descripcion or "computadora" in descripcion or "notebook" in descripcion:
            partida = "8471.30.00.00"
        elif "celular" in descripcion or "móvil" in descripcion or "teléfono" in descripcion:
            partida = "8517.12.00.00"
        else:
            partida = "0000.00.00.00"  # Partida genérica (requiere corrección manual)
            
        # Validaciones de consistencia
        if item.precio_unitario <= 0:
            inconsistente = True
            observaciones_item.append("Precio del ítem igual o inferior a 0.")
        
        if item.cantidad <= 0:
            inconsistente = True
            observaciones_item.append("Cantidad vacía o en valor nulo.")

        if partida == "0000.00.00.00":
            inconsistente = True
            observaciones_item.append("Producto no reconocido en el catálogo de partidas.")

        # Nivel de riesgo del ítem
        nivel = NivelRiesgo.BAJO.value
        if inconsistente:
             nivel = NivelRiesgo.ALTO.value
             
        return RiesgoEvaluacion(
             inconsistente=inconsistente,
             sugerencia_partida=partida,
             observaciones="; ".join(observaciones_item),
             nivel_riesgo_general=nivel
        )

    @classmethod
    def procesar_factura_completa(cls, factura: schemas.FacturaCreate) -> RiesgoEvaluacion:
        """
        Evalúa la factura completa y asigna un semáforo de riesgo global:
        - Bajo:  Todo válido, partidas asignadas.
        - Medio: Se detectaron faltantes menores.
        - Alto:  Datos críticos faltantes o descuadre contable.
        """
        observaciones_globales = []
        nivel_final = NivelRiesgo.BAJO.value
        items_inconsistentes = 0
        total_calculado = 0.0
        
        # 1. Validación de campos principales
        if not factura.numero_factura or not factura.monto_total or factura.monto_total <= 0:
            nivel_final = NivelRiesgo.ALTO.value
            observaciones_globales.append("Campos principales incompletos o inválidos (Monto/Número).")
            
        # 2. Evaluación de cada ítem
        if not factura.detalles:
            nivel_final = NivelRiesgo.ALTO.value
            observaciones_globales.append("La factura no posee ítems descriptivos.")
        else:
            for item in factura.detalles:
                res = cls.evaluar_item(item)
                total_calculado += (item.precio_unitario * item.cantidad)
                if res.inconsistente:
                    items_inconsistentes += 1
        
        # 3. Verificación de consistencia contable (suma de ítems vs total declarado)
        margen_error = 2.0
        if factura.monto_total and abs(total_calculado - factura.monto_total) > margen_error:
            nivel_final = NivelRiesgo.ALTO.value
            observaciones_globales.append("Descuadre contable entre la cabecera y los ítems.")

        # 4. Asignación final del semáforo
        if nivel_final != NivelRiesgo.ALTO.value:
            if items_inconsistentes > 0:
                nivel_final = NivelRiesgo.MEDIO.value
                observaciones_globales.append(f"Existen {items_inconsistentes} elemento(s) inconsistentes a revisar.")
            else:
                nivel_final = NivelRiesgo.BAJO.value
                observaciones_globales.append("Operación calificada como apta y consistente.")

        return RiesgoEvaluacion(
            inconsistente=(items_inconsistentes > 0 or nivel_final != NivelRiesgo.BAJO.value),
            sugerencia_partida="",
            observaciones="; ".join(observaciones_globales),
            nivel_riesgo_general=nivel_final
        )
