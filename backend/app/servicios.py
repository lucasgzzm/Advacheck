from dataclasses import dataclass
from typing import List
from . import esquemas
from .modelos import NivelRiesgo


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
    def evaluar_item(cls, item: esquemas.FacturaDetalleCreate) -> RiesgoEvaluacion:
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
    def procesar_factura_completa(cls, factura: esquemas.FacturaCreate) -> RiesgoEvaluacion:
        """
        Evalúa la factura con criterios de auditoría senior:
        - Validación de Incoterm vs Gastos (Flete/Seguro).
        - Consistencia de Pesos (Bruto vs Neto).
        - Detección de descripciones ambiguas.
        - Cuadre contable (CIF = Subtotal + Flete + Seguro + Otros).
        """
        observaciones_globales = []
        nivel_final = NivelRiesgo.BAJO.value
        items_inconsistentes = 0
        total_calculado_items = 0.0
        
        # 1. Validación de campos principales
        if not factura.numero_factura:
            nivel_final = NivelRiesgo.ALTO.value
            observaciones_globales.append("Número de factura no detectado.")
            
        if not factura.monto_total or factura.monto_total <= 0:
            nivel_final = NivelRiesgo.ALTO.value
            observaciones_globales.append("Monto total inválido o no detectado.")

        # 2. Validación de Incoterm vs Cargos
        incoterm = (factura.incoterm or "").upper()
        if "CIF" in incoterm:
            if (factura.monto_flete or 0) <= 0 or (factura.monto_seguro or 0) <= 0:
                nivel_final = NivelRiesgo.ALTO.value
                observaciones_globales.append("Incoterm CIF detectado pero falta flete o seguro (Riesgo de Ajuste de Valor).")
        elif "FOB" in incoterm:
            if (factura.monto_flete or 0) > 0 or (factura.monto_seguro or 0) > 0:
                nivel_final = NivelRiesgo.MEDIO.value
                observaciones_globales.append("Incoterm FOB con cargos de flete/seguro incluidos (Verificar términos).")

        # 3. Validación de Pesos
        if factura.peso_bruto and factura.peso_neto:
            if factura.peso_neto > factura.peso_bruto:
                nivel_final = NivelRiesgo.ALTO.value
                observaciones_globales.append("Inconsistencia logística: El peso neto supera al peso bruto.")
        elif not factura.peso_bruto:
            nivel_final = NivelRiesgo.MEDIO.value
            observaciones_globales.append("Peso bruto no declarado (Posible Canal Rojo).")

        # 4. País de Origen y Cumplimiento de Receptor
        if not factura.pais_origen:
            nivel_final = NivelRiesgo.MEDIO.value
            observaciones_globales.append("País de origen no especificado (Riesgo de medidas antidumping/TLC).")

        # Regla Específica: Chile (RUT Obligatorio)
        pais_receptor = (factura.receptor_pais or "").upper()
        if "CHILE" in pais_receptor or "CL" == pais_receptor:
            if not factura.receptor_tax_id or factura.receptor_tax_id.strip() == "":
                nivel_final = NivelRiesgo.ALTO.value
                observaciones_globales.append("Falta RUT del Importador (Obligatorio para desaduanamiento en Chile).")

        # 5. Evaluación de ítems y descripciones
        if not factura.detalles:
            nivel_final = NivelRiesgo.ALTO.value
            observaciones_globales.append("La factura no posee ítems descriptivos.")
        else:
            for item in factura.detalles:
                res = cls.evaluar_item(item)
                total_calculado_items += (item.precio_unitario * item.cantidad)
                
                # Regla de descripción ambigua
                desc = item.descripcion_producto.lower()
                palabras_ambiguas = ["repuestos", "mercancia", "parts", "miscellaneous", "various", "clothing"]
                if len(desc) < 8 or any(p in desc for p in palabras_ambiguas):
                    nivel_final = NivelRiesgo.ALTO.value
                    observaciones_globales.append(f"Descripción ambigua detectada: '{item.descripcion_producto}'.")

                if res.inconsistente:
                    items_inconsistentes += 1
        
        # 6. Verificación de cuadre contable (Aritmética Aduanera)
        # Algoritmo: Subtotal (Ítems) + Freight + Insurance + Others == Invoice Total
        suma_cargos = (factura.monto_subtotal or total_calculado_items) + (factura.monto_flete or 0) + (factura.monto_seguro or 0) + (factura.monto_otros_gastos or 0)
        margen_error = 2.0
        if abs(suma_cargos - (factura.monto_total or 0)) > margen_error:
            nivel_final = NivelRiesgo.ALTO.value
            observaciones_globales.append(f"Aritmética Aduanera Inconsistente: La suma de Cargos ({suma_cargos} {factura.moneda}) no cuadra con el Total Facturado ({factura.monto_total} {factura.moneda}).")

        # 7. Asignación final del semáforo
        if nivel_final != NivelRiesgo.ALTO.value:
            if items_inconsistentes > 0 or nivel_final == NivelRiesgo.MEDIO.value:
                nivel_final = NivelRiesgo.MEDIO.value
            else:
                nivel_final = NivelRiesgo.BAJO.value
                observaciones_globales.append("Operación consistente bajo criterios estándar.")

        return RiesgoEvaluacion(
            inconsistente=(nivel_final != NivelRiesgo.BAJO.value),
            sugerencia_partida="",
            observaciones="; ".join(observaciones_globales),
            nivel_riesgo_general=nivel_final
        )

