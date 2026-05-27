"""
Servicio de validación cruzada multi-documento para operaciones aduaneras.

Recibe tres diccionarios JSON con los datos ya estructurados por Gemini
(Factura Comercial, Packing List, Bill of Lading / Guía Aérea) y ejecuta
reglas de cruce estrictas para detectar descalces.
"""

from typing import List, Optional, Tuple
from difflib import SequenceMatcher
import logging

from .esquemas import DiscrepanciaValidacion, ResultadoValidacionCruzada
from .utilidades import (
    obtener_valor_anidado as _obtener_valor,
    comparar_textos as _texto_coincide,
    normalizar_numero as _normalizar_numero
)

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
#  Constantes y helpers
# ──────────────────────────────────────────────

UMBRAL_SIMILITUD_NOMBRE = 0.75
TOLERANCIA_PESO_KG = 5.0
TOLERANCIA_BULTOS = 1
TOLERANCIA_PORCENTUAL_PESO = 0.05  # 5%



# ──────────────────────────────────────────────
#  Funciones de validación
# ──────────────────────────────────────────────

def validar_pesos_y_bultos(
    factura: dict,
    packing_list: dict,
    bl: dict,
) -> List[DiscrepanciaValidacion]:
    """
    Compara el Peso Bruto (Gross Weight) y la cantidad de bultos
    descritos en el B/L vs Packing List vs Factura.

    Retorna:
        Lista de discrepancias encontradas.
    """
    discrepancias: List[DiscrepanciaValidacion] = []

    # ─── Peso Bruto ──────────────────────────────────────
    peso_factura = _normalizar_numero(
        _obtener_valor(factura, "pesos", "bruto", default=None)
    )
    peso_packing = _normalizar_numero(
        _obtener_valor(packing_list, "pesos", "bruto",
                       default=_obtener_valor(packing_list, "peso_bruto", default=None))
    )
    peso_bl = _normalizar_numero(
        _obtener_valor(bl, "pesos", "bruto",
                       default=_obtener_valor(bl, "peso_bruto", default=None))
    )

    # Valores de referencia para mensajes
    unidad = (
        _obtener_valor(factura, "pesos", "unidad", default="kg")
        or _obtener_valor(packing_list, "pesos", "unidad", default="kg")
        or "kg"
    )

    if peso_bl is not None and peso_packing is not None:
        diff = abs(peso_bl - peso_packing)
        diff_pct = diff / max(peso_bl, peso_packing, 1)
        if diff > TOLERANCIA_PESO_KG and diff_pct > TOLERANCIA_PORCENTUAL_PESO:
            discrepancias.append(
                DiscrepanciaValidacion(
                    campo="Peso Bruto (B/L vs Packing List)",
                    descripcion=(
                        f"El peso bruto del B/L es {peso_bl:.2f} {unidad}, "
                        f"mientras que el Packing List declara {peso_packing:.2f} {unidad}. "
                        f"Diferencia absoluta: {diff:.2f} {unidad} "
                        f"({diff_pct*100:.1f}% de variación)."
                    ),
                    severidad="ALTA" if diff_pct > 0.10 else "MEDIA",
                    detalle={
                        "valor_bl": peso_bl,
                        "valor_packing": peso_packing,
                        "diferencia_absoluta": round(diff, 2),
                        "diferencia_porcentual": round(diff_pct * 100, 1),
                        "unidad": unidad,
                    },
                )
            )
        else:
            logger.info(
                "Peso Bruto OK: B/L=%.2f, Packing=%.2f, diff=%.2f",
                peso_bl, peso_packing, diff,
            )

    if peso_factura is not None and peso_bl is not None:
        diff = abs(peso_factura - peso_bl)
        diff_pct = diff / max(peso_factura, peso_bl, 1)
        if diff > TOLERANCIA_PESO_KG and diff_pct > TOLERANCIA_PORCENTUAL_PESO:
            discrepancias.append(
                DiscrepanciaValidacion(
                    campo="Peso Bruto (Factura vs B/L)",
                    descripcion=(
                        f"El peso bruto en la Factura es {peso_factura:.2f} {unidad}, "
                        f"pero en el B/L figura {peso_bl:.2f} {unidad}. "
                        f"Diferencia: {diff:.2f} {unidad} ({diff_pct*100:.1f}%)."
                    ),
                    severidad="ALTA" if diff_pct > 0.10 else "MEDIA",
                    detalle={
                        "valor_factura": peso_factura,
                        "valor_bl": peso_bl,
                        "diferencia_absoluta": round(diff, 2),
                        "diferencia_porcentual": round(diff_pct * 100, 1),
                        "unidad": unidad,
                    },
                )
            )

    # ─── Bultos / Paquetes ────────────────────────────────
    bultos_bl = _normalizar_numero(
        _obtener_valor(bl, "bultos", default=_obtener_valor(bl, "cantidad_bultos", default=None))
    )
    bultos_packing = _normalizar_numero(
        _obtener_valor(packing_list, "bultos",
                       default=_obtener_valor(packing_list, "total_bultos", default=None))
    )
    bultos_factura = _normalizar_numero(
        _obtener_valor(factura, "bultos",
                       default=_obtener_valor(factura, "total_bultos", default=None))
    )

    if bultos_bl is not None and bultos_packing is not None:
        if abs(bultos_bl - bultos_packing) > TOLERANCIA_BULTOS:
            discrepancias.append(
                DiscrepanciaValidacion(
                    campo="Cantidad de Bultos (B/L vs Packing List)",
                    descripcion=(
                        f"El B/L reporta {int(bultos_bl)} bulto(s), "
                        f"pero el Packing List suma {int(bultos_packing)} bulto(s). "
                        f"Diferencia de {int(abs(bultos_bl - bultos_packing))} bulto(s)."
                    ),
                    severidad="ALTA",
                    detalle={
                        "bultos_bl": int(bultos_bl),
                        "bultos_packing": int(bultos_packing),
                        "diferencia": int(abs(bultos_bl - bultos_packing)),
                    },
                )
            )

    if bultos_factura is not None and bultos_bl is not None:
        if abs(bultos_factura - bultos_bl) > TOLERANCIA_BULTOS:
            discrepancias.append(
                DiscrepanciaValidacion(
                    campo="Cantidad de Bultos (Factura vs B/L)",
                    descripcion=(
                        f"La Factura declara {int(bultos_factura)} bulto(s), "
                        f"mientras que el B/L reporta {int(bultos_bl)} bulto(s). "
                        f"Discrepancia de {int(abs(bultos_factura - bultos_bl))} bulto(s)."
                    ),
                    severidad="MEDIA",
                    detalle={
                        "bultos_factura": int(bultos_factura),
                        "bultos_bl": int(bultos_bl),
                        "diferencia": int(abs(bultos_factura - bultos_bl)),
                    },
                )
            )

    return discrepancias


def validar_identidad_proveedor(
    factura: dict,
    bl: dict,
) -> List[DiscrepanciaValidacion]:
    """
    Verifica que el nombre y Tax ID del Exportador / Supplier
    sean consistentes entre la Factura y el B/L.

    Retorna:
        Lista de discrepancias encontradas.
    """
    discrepancias: List[DiscrepanciaValidacion] = []

    emisor_factura = factura.get("emisor", {}) or {}
    emisor_bl = bl.get("exportador", {}) or bl.get("emisor", {}) or {}

    nombre_factura = _obtener_valor(emisor_factura, "nombre", "name", default="")
    nombre_bl = _obtener_valor(emisor_bl, "nombre", "name", default="")

    tax_factura = _obtener_valor(emisor_factura, "tax_id", "taxId", default="")
    tax_bl = _obtener_valor(emisor_bl, "tax_id", "taxId", default="")

    # ─── Nombre del exportador ────────────────────────────
    if nombre_factura and nombre_bl:
        coincide, score = _texto_coincide(nombre_factura, nombre_bl)
        if not coincide:
            discrepancias.append(
                DiscrepanciaValidacion(
                    campo="Nombre del Exportador / Proveedor",
                    descripcion=(
                        f"El nombre del exportador en la Factura "
                        f"('{nombre_factura}') no coincide con el "
                        f"reportado en el B/L ('{nombre_bl}'). "
                        f"Similitud: {score*100:.1f}%."
                    ),
                    severidad="ALTA" if score < 0.40 else "MEDIA",
                    detalle={
                        "nombre_factura": nombre_factura,
                        "nombre_bl": nombre_bl,
                        "similitud": score,
                    },
                )
            )

    # ─── Tax ID del exportador ────────────────────────────
    if tax_factura and tax_bl:
        tax_factura_limpio = tax_factura.replace(" ", "").replace("-", "")
        tax_bl_limpio = tax_bl.replace(" ", "").replace("-", "")
        if tax_factura_limpio != tax_bl_limpio:
            discrepancias.append(
                DiscrepanciaValidacion(
                    campo="Tax ID del Exportador / Proveedor",
                    descripcion=(
                        f"El Tax ID en la Factura ({tax_factura}) difiere "
                        f"del registrado en el B/L ({tax_bl}). "
                        f"Los identificadores tributarios deben coincidir "
                        f"exactamente entre documentos de la misma operación."
                    ),
                    severidad="ALTA",
                    detalle={
                        "tax_id_factura": tax_factura,
                        "tax_id_bl": tax_bl,
                    },
                )
            )
    elif (tax_factura and not tax_bl) or (not tax_factura and tax_bl):
        discrepancias.append(
            DiscrepanciaValidacion(
                campo="Tax ID del Exportador",
                descripcion=(
                    "El Tax ID del exportador solo está presente en uno de los documentos. "
                    "No es posible confirmar que el proveedor sea el mismo."
                ),
                severidad="MEDIA",
            )
        )

    return discrepancias


def validar_cantidades_items(
    factura: dict,
    packing_list: dict,
) -> List[DiscrepanciaValidacion]:
    """
    Cruza ítem por ítem las cantidades declaradas en la Factura
    con las unidades físicas y distribución del Packing List.

    Retorna:
        Lista de discrepancias encontradas.
    """
    discrepancias: List[DiscrepanciaValidacion] = []

    detalles_factura = factura.get("detalles", []) or []
    items_packing = packing_list.get("detalles", []) or packing_list.get("items", []) or []

    if not detalles_factura or not items_packing:
        if not detalles_factura:
            discrepancias.append(
                DiscrepanciaValidacion(
                    campo="Ítems en Factura",
                    descripcion="La Factura no contiene ítems descriptivos. Imposible cruzar cantidades.",
                    severidad="ALTA",
                )
            )
        if not items_packing:
            discrepancias.append(
                DiscrepanciaValidacion(
                    campo="Ítems en Packing List",
                    descripcion="El Packing List no contiene ítems detallados. Imposible cruzar cantidades.",
                    severidad="ALTA",
                )
            )
        return discrepancias

    # Indexar ítems del Packing List por descripción normalizada
    packing_index: List[dict] = []
    for item in items_packing:
        desc = (
            _obtener_valor(item, "descripcion_producto", "descripcion", default="")
            or ""
        ).lower().strip()
        cantidad = _normalizar_numero(
            _obtener_valor(item, "cantidad", "quantity", default=0)
        ) or 0
        packing_index.append({"descripcion": desc, "cantidad": cantidad, "original": item})

    items_no_match = 0
    items_match = 0

    for i, item_f in enumerate(detalles_factura):
        desc_f = (
            _obtener_valor(item_f, "descripcion_producto", "descripcion", default="")
            or ""
        ).lower().strip()
        cant_f = _normalizar_numero(
            _obtener_valor(item_f, "cantidad", "quantity", default=0)
        ) or 0

        if not desc_f or cant_f <= 0:
            continue

        # Buscar el ítem más similar en el Packing List
        mejor_coincidencia = None
        mejor_score = 0
        for p_item in packing_index:
            if not p_item["descripcion"]:
                continue
            score = SequenceMatcher(None, desc_f, p_item["descripcion"]).ratio()
            if score > mejor_score:
                mejor_score = score
                mejor_coincidencia = p_item

        if mejor_coincidencia and mejor_score >= UMBRAL_SIMILITUD_NOMBRE:
            cant_p = mejor_coincidencia["cantidad"]
            if abs(cant_f - cant_p) > 1:  # Tolerancia de 1 unidad
                desc_original = (
                    _obtener_valor(item_f, "descripcion_producto", "descripcion", default="")
                    or ""
                )
                desc_p = (
                    _obtener_valor(mejor_coincidencia["original"], "descripcion_producto", "descripcion", default="")
                    or ""
                )
                discrepancias.append(
                    DiscrepanciaValidacion(
                        campo=f"Cantidad de Ítem: '{desc_original[:60]}'",
                        descripcion=(
                            f"La Factura declara {cant_f:.0f} unidades del producto "
                            f"'{desc_original}', pero el Packing List reporta "
                            f"{cant_p:.0f} unidades ('{desc_p}'). "
                            f"Diferencia de {abs(cant_f - cant_p):.0f} unidades."
                        ),
                        severidad="ALTA" if abs(cant_f - cant_p) > 5 else "MEDIA",
                        detalle={
                            "descripcion_factura": desc_original,
                            "descripcion_packing": desc_p,
                            "cantidad_factura": cant_f,
                            "cantidad_packing": cant_p,
                            "diferencia": abs(cant_f - cant_p),
                        },
                    )
                )
            else:
                items_match += 1
        else:
            items_no_match += 1
            desc_original = (
                _obtener_valor(item_f, "descripcion_producto", "descripcion", default="")
                or ""
            )
            discrepancias.append(
                DiscrepanciaValidacion(
                    campo=f"Ítem sin correlato en Packing List: '{desc_original[:60]}'",
                    descripcion=(
                        f"El producto '{desc_original}' aparece en la Factura "
                        f"con cantidad {cant_f:.0f}, pero no se encontró un ítem "
                        f"correspondiente en el Packing List (mejor similitud: {mejor_score*100:.0f}%)."
                    ),
                    severidad="ALTA" if cant_f > 10 else "MEDIA",
                    detalle={
                        "descripcion_factura": desc_original,
                        "cantidad_factura": cant_f,
                        "mejor_similitud": mejor_score,
                    },
                )
            )

    return discrepancias


# ──────────────────────────────────────────────
#  Orquestador
# ──────────────────────────────────────────────

class ServicioValidacionCruzada:
    """
    Orquesta la validación cruzada entre tres documentos aduaneros
    ya estructurados: Factura Comercial, Packing List y Bill of Lading.
    """

    @staticmethod
    def ejecutar(
        factura: dict,
        packing_list: Optional[dict] = None,
        bl: Optional[dict] = None,
    ) -> ResultadoValidacionCruzada:
        """
        Punto de entrada principal. Ejecuta todas las validaciones
        de cruce y retorna un resultado estructurado.

        Args:
            factura: Diccionario con datos estructurados de la Factura Comercial.
            packing_list: Diccionario con datos estructurados del Packing List.
            bl: Diccionario con datos estructurados del Bill of Lading.

        Returns:
            ResultadoValidacionCruzada con discrepancias, coincidencias y conclusión.
        """
        discrepancias: List[DiscrepanciaValidacion] = []
        coincidencias: List[str] = []
        documentos_disponibles = ["Factura Comercial"]

        # Identificar tipo de B/L
        if bl is not None:
            bl_tipo = (
                _obtener_valor(bl, "tipo_documento", default="")
                or "Bill of Lading"
            )
            documentos_disponibles.append(bl_tipo)
        else:
            documentos_disponibles.append("Bill of Lading (no disponible)")

        if packing_list is not None:
            documentos_disponibles.append("Packing List")
        else:
            documentos_disponibles.append("Packing List (no disponible)")

        # ─── 1. Pesos y Bultos ────────────────────────────
        if bl is not None and packing_list is not None:
            peso_pb = validar_pesos_y_bultos(factura, packing_list, bl)
            discrepancias.extend(peso_pb)

            # Generar coincidencias si no hay discrepancias de peso
            peso_bl = _normalizar_numero(
                _obtener_valor(bl, "pesos", "bruto", default=None)
            )
            peso_pk = _normalizar_numero(
                _obtener_valor(packing_list, "pesos", "bruto", default=None)
            )
            if peso_bl is not None and peso_pk is not None:
                if abs(peso_bl - peso_pk) <= TOLERANCIA_PESO_KG:
                    coincidencias.append(
                        f"Peso Bruto consistente entre B/L y Packing List "
                        f"({peso_bl:.2f} kg)."
                    )

            bultos_bl = _normalizar_numero(
                _obtener_valor(bl, "bultos", default=None)
            )
            bultos_pk = _normalizar_numero(
                _obtener_valor(packing_list, "bultos", default=None)
            )
            if bultos_bl is not None and bultos_pk is not None:
                if abs(bultos_bl - bultos_pk) <= TOLERANCIA_BULTOS:
                    coincidencias.append(
                        f"Cantidad de bultos consistente: {int(bultos_bl)} bulto(s) "
                        f"en ambos documentos."
                    )

        elif bl is not None:
            logger.info("Packing List no disponible — saltando validación de pesos/bultos.")
        elif packing_list is not None:
            logger.info("B/L no disponible — saltando validación de pesos/bultos.")

        # ─── 2. Identidad del proveedor ────────────────────
        if bl is not None:
            id_prov = validar_identidad_proveedor(factura, bl)
            discrepancias.extend(id_prov)

            # Coincidencias de proveedor
            emisor_f = factura.get("emisor", {}) or {}
            emisor_b = bl.get("exportador", {}) or bl.get("emisor", {}) or {}
            nom_f = _obtener_valor(emisor_f, "nombre", default="")
            nom_b = _obtener_valor(emisor_b, "nombre", default="")
            if nom_f and nom_b:
                coincide, score = _texto_coincide(nom_f, nom_b)
                if coincide:
                    coincidencias.append(
                        f"Nombre del exportador coincide en Factura y B/L: '{nom_f}'."
                    )

            tax_f = _obtener_valor(emisor_f, "tax_id", default="")
            tax_b = _obtener_valor(emisor_b, "tax_id", default="")
            if tax_f and tax_b:
                tf = tax_f.replace(" ", "").replace("-", "")
                tb = tax_b.replace(" ", "").replace("-", "")
                if tf == tb:
                    coincidencias.append(
                        f"Tax ID del exportador consistente: {tax_f}."
                    )

        # ─── 3. Cantidades de ítems ────────────────────────
        if packing_list is not None:
            cant_items = validar_cantidades_items(factura, packing_list)
            discrepancias.extend(cant_items)

            # Coincidencias de ítems
            det_f = factura.get("detalles", []) or []
            det_p = packing_list.get("detalles", []) or packing_list.get("items", []) or []
            if det_f and det_p and len(det_f) == len(det_p):
                coincidencias.append(
                    f"Correspondencia de {len(det_f)} ítem(s) entre Factura y Packing List."
                )

        # ─── 4. Países / Puertos (si hay B/L) ──────────────
        if bl is not None:
            puerto_bl = _obtener_valor(bl, "puerto_descarga", "puerto_destino", default="")
            pais_factura = _obtener_valor(factura, "pais_origen", default="")
            puerto_factura = _obtener_valor(
                factura.get("transporte", {}), "puerto_destino",
                default=_obtener_valor(factura, "puerto_destino", default=""),
            )

            if puerto_bl and puerto_factura:
                coincide, _ = _texto_coincide(puerto_bl, puerto_factura)
                if coincide:
                    coincidencias.append(
                        f"Puerto de descarga consistente: '{puerto_bl}'."
                    )

            # País de origen vs. exportador
            pais_exportador = _obtener_valor(
                bl.get("exportador", {}) or bl.get("emisor", {}),
                "pais", "country", default="",
            )
            if pais_factura and pais_exportador:
                coincide, _ = _texto_coincide(pais_factura, pais_exportador)
                if coincide:
                    coincidencias.append(
                        f"País de origen coincide en todos los documentos: {pais_factura}."
                    )

        # ─── 5. Conclusión ──────────────────────────────────
        total_discrepancias = len(discrepancias)
        alto_riesgo = sum(1 for d in discrepancias if d.severidad == "ALTA")

        if total_discrepancias == 0:
            conclusion = (
                "Todos los documentos se encuentran conciliados. "
                "Los pesos, bultos, identidad del proveedor y cantidades "
                "coinciden dentro de los márgenes de tolerancia. "
                "La operación está lista para despacho."
            )
        elif alto_riesgo > 0:
            conclusion = (
                f"Se detectaron {alto_riesgo} discrepancia(s) de alto riesgo "
                f"y {total_discrepancias - alto_riesgo} discrepancia(s) adicional(es) "
                f"que requieren revisión antes del despacho aduanero."
            )
        else:
            conclusion = (
                f"Se encontraron {total_discrepancias} discrepancia(s) de severidad "
                f"media o baja. Se recomienda revisar y corregir antes del despacho."
            )

        return ResultadoValidacionCruzada(
            documentos_identificados=documentos_disponibles,
            discrepancias_encontradas=total_discrepancias > 0,
            lista_discrepancias=discrepancias,
            coincidencias_clave=coincidencias,
            conclusion=conclusion,
        )
