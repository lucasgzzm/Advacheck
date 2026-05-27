import logging
from datetime import datetime, timedelta
from typing import Optional, Literal
from difflib import SequenceMatcher

from .modelos import NivelRiesgo

logger = logging.getLogger(__name__)

ESTADO = Literal["PASS", "WARNING", "FAIL", "NO_EJECUTADA"]
SEVERIDAD = Literal["BAJA", "MEDIA", "ALTA"]

from .catalogo_regulatorio import (
    ENTIDADES_POR_PARTIDA,
    INCOTERMS_VALIDOS,
    INCOTERMS_MARITIMOS,
    INCOTERMS_SEGURO_OBLIGA,
    MONEDAS_VALIDAS,
    normalizar_partida as _normalizar_partida
)
from .utilidades import (
    convertir_a_float as _float,
    obtener_valor_anidado as _obtener_valor,
    coincide_patron as _coincide_patron
)

PATRONES_CONFIANZA = {
    "numero_factura": r'^[A-Za-z0-9][A-Za-z0-9\-\/\.\#]{1,30}$',
    "moneda": r'^[A-Z]{3}$',
    "incoterm": r'^(FOB|CIF|CFR|CPT|CIP|EXW|FCA|FAS|DAT|DAP|DDP)$',
    "email": r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
    "tax_id": r'^[A-Za-z0-9\.\-]{4,20}$',
}

def evaluar_confianza_extraccion(datos: dict) -> dict:
    """Evalúa la confianza de cada campo extraído del documento."""
    confianza = {}
    base = 85

    # --- numero_factura ---
    nf = (datos.get("numero_factura") or "").strip()
    if not nf or nf in ("N/A", "NA", "n/a", "S/N", "0"):
        confianza["numero_factura"] = 15
    elif _coincide_patron(nf, PATRONES_CONFIANZA["numero_factura"]):
        confianza["numero_factura"] = base
    elif len(nf) >= 4:
        confianza["numero_factura"] = 60
    else:
        confianza["numero_factura"] = 35

    # --- monto_total ---
    mt = _float(datos.get("monto_total") or datos.get("monto_total_cif"))
    if mt <= 0:
        confianza["monto_total"] = 10
    elif mt > 100_000_000:
        confianza["monto_total"] = 60
    else:
        confianza["monto_total"] = base

    # --- subtotal ---
    st = _float(datos.get("monto_subtotal"))
    confianza["monto_subtotal"] = base if st > 0 else 40

    # --- flete ---
    fl = _float(datos.get("monto_flete"))
    if fl < 0:
        confianza["monto_flete"] = 20
    else:
        confianza["monto_flete"] = 85 if fl > 0 else 70

    # --- seguro ---
    sg = _float(datos.get("monto_seguro"))
    if sg < 0:
        confianza["monto_seguro"] = 20
    else:
        confianza["monto_seguro"] = 85 if sg > 0 else 70

    # --- incoterm ---
    inc = (datos.get("incoterm") or "").strip().upper()
    if not inc:
        confianza["incoterm"] = 15
    elif _coincide_patron(inc, PATRONES_CONFIANZA["incoterm"]):
        confianza["incoterm"] = base
    else:
        confianza["incoterm"] = 40

    # --- moneda ---
    mon = (datos.get("moneda") or "").strip().upper()
    if not mon:
        confianza["moneda"] = 20
    elif mon in MONEDAS_VALIDAS:
        confianza["moneda"] = base
    else:
        confianza["moneda"] = 50

    # --- fecha_emision ---
    fe = datos.get("fecha_emision") or ""
    if not fe:
        confianza["fecha_emision"] = 15
    else:
        try:
            fmt = "%Y-%m-%d" if "T" not in str(fe) else "%Y-%m-%dT%H:%M:%S"
            datetime.strptime(str(fe)[:19], fmt)
            confianza["fecha_emision"] = base
        except (ValueError, TypeError):
            confianza["fecha_emision"] = 40

    # --- pais_origen ---
    po = datos.get("pais_origen") or ""
    confianza["pais_origen"] = base if len(po) >= 2 else 30

    # --- emisor ---
    emisor = datos.get("emisor") or {}
    em_nombre = (emisor.get("nombre") or "").strip()
    if not em_nombre or em_nombre in ("Desconocido", "No detectado", "N/A"):
        confianza["emisor_nombre"] = 20
    elif len(em_nombre) < 5:
        confianza["emisor_nombre"] = 45
    else:
        confianza["emisor_nombre"] = base

    em_tax = (emisor.get("tax_id") or "").strip()
    if not em_tax:
        confianza["emisor_tax_id"] = 20
    elif _coincide_patron(em_tax, PATRONES_CONFIANZA["tax_id"]):
        confianza["emisor_tax_id"] = base
    else:
        confianza["emisor_tax_id"] = 50

    # --- receptor ---
    receptor = datos.get("receptor") or {}
    rc_nombre = (receptor.get("nombre") or datos.get("receptor_nombre") or "").strip()
    confianza["receptor_nombre"] = base if len(rc_nombre) >= 5 else 30

    rc_tax = (receptor.get("tax_id") or datos.get("receptor_tax_id") or "").strip()
    if not rc_tax:
        confianza["receptor_tax_id"] = 20
    elif _coincide_patron(rc_tax, PATRONES_CONFIANZA["tax_id"]):
        confianza["receptor_tax_id"] = base
    else:
        confianza["receptor_tax_id"] = 50

    # --- detalles (por ítem) ---
    detalles = datos.get("detalles") or []
    for i, d in enumerate(detalles):
        if _float(d.get("cantidad")) <= 0:
            confianza[f"detalle_{i}_cantidad"] = 30
        else:
            confianza[f"detalle_{i}_cantidad"] = base

        if _float(d.get("precio_unitario")) <= 0:
            confianza[f"detalle_{i}_precio"] = 25
        else:
            confianza[f"detalle_{i}_precio"] = base

        desc = (d.get("descripcion_producto") or "").strip()
        if not desc or len(desc) < 5:
            confianza[f"detalle_{i}_descripcion"] = 25
        elif len(desc) < 10:
            confianza[f"detalle_{i}_descripcion"] = 50
        else:
            confianza[f"detalle_{i}_descripcion"] = base

    # --- Penalización por validacion_error ---
    if datos.get("validacion_error"):
        for k in confianza:
            confianza[k] = min(confianza[k], 50)

    # --- Cuadratura de ítems vs total declarado ---
    suma_items = sum(
        _float(d.get("cantidad", 0)) * _float(d.get("precio_unitario", 0))
        for d in detalles
    )
    if mt > 0 and suma_items > 0:
        diff_pct = abs(suma_items - mt) / mt * 100
        if diff_pct > 2:
            confianza["cuadratura_items"] = max(20, 85 - diff_pct * 2)
        else:
            confianza["cuadratura_items"] = 90

    return confianza


def verificar_cuadratura_items(datos: dict) -> dict:
    """Verifica que la suma de ítems coincida con el subtotal o total CIF."""
    detalles = datos.get("detalles") or []
    moneda = datos.get("moneda") or "USD"
    if not detalles:
        return {"ejecutado": False, "mensaje": "No hay detalles (ítems) en la factura.", "items": []}

    suma_items = sum(
        _float(d.get("cantidad", 0)) * _float(d.get("precio_unitario", 0))
        for d in detalles
    )

    subtotal_declarado = _float(datos.get("monto_subtotal") or datos.get("subtotal"))
    total_cif = _float(datos.get("monto_total") or datos.get("monto_total_cif"))

    if subtotal_declarado > 0:
        total_ref = subtotal_declarado
        tipo_comp = "subtotal"
    else:
        total_ref = total_cif
        tipo_comp = "total_cif"

    diff = abs(round(suma_items - total_ref, 2))
    diff_pct = round(diff / total_ref * 100, 2) if total_ref > 0 else 0
    coincide = diff <= 2.00
    estado = "PASS" if coincide else "WARNING" if diff_pct <= 5 else "FAIL"

    items_detalle = []
    for i, d in enumerate(detalles):
        cant = _float(d.get("cantidad"))
        pu = _float(d.get("precio_unitario"))
        items_detalle.append({
            "indice": i,
            "descripcion": (d.get("descripcion_producto") or f"Ítem #{i+1}")[:60],
            "cantidad": cant,
            "precio_unitario": pu,
            "subtotal_calculado": round(cant * pu, 2),
        })

    if coincide:
        if tipo_comp == "subtotal":
            msg = f"Suma de ítems ({suma_items:.2f}) coincide con el subtotal declarado ({total_ref:.2f}) {moneda}. CIF total: {total_cif:.2f}."
        else:
            msg = f"Suma de ítems ({suma_items:.2f}) coincide con el total CIF declarado ({total_ref:.2f}) {moneda}."
    else:
        if tipo_comp == "subtotal":
            msg = (
                f"Suma de ítems ({suma_items:.2f}) ≠ subtotal declarado ({total_ref:.2f}) {moneda}. "
                f"Diferencia: {diff:.2f} ({diff_pct:.1f}%). "
                f"El CIF total ({total_cif:.2f}) incluye flete/seguro/otros."
            )
        else:
            msg = (
                f"Suma de ítems ({suma_items:.2f}) ≠ total CIF declarado ({total_ref:.2f}) {moneda}. "
                f"Diferencia: {diff:.2f} ({diff_pct:.1f}%). "
                f"Verificar si flete/seguro/otros están incluidos en el total."
            )

    return {
        "ejecutado": True,
        "tipo_comparacion": tipo_comp,
        "subtotal_declarado": round(subtotal_declarado, 2) if subtotal_declarado > 0 else None,
        "total_cif_declarado": round(total_cif, 2) if total_cif > 0 else None,
        "total_calculado": round(suma_items, 2),
        "diferencia": diff,
        "diferencia_porcentaje": diff_pct,
        "moneda": moneda,
        "coincide": coincide,
        "estado": estado,
        "mensaje": msg,
        "items": items_detalle,
    }


class ControlPrevalidacion:
    """Representa un control individual dentro de una etapa de prevalidación."""
    def __init__(self, nombre: str, estado: ESTADO, mensaje: str, detalle: Optional[str] = None):
        self.nombre = nombre
        self.estado = estado
        self.mensaje = mensaje
        self.detalle = detalle

    def to_dict(self) -> dict:
        """Convierte el control a diccionario serializable."""
        return {
            "nombre": self.nombre,
            "estado": self.estado,
            "mensaje": self.mensaje,
            "detalle": self.detalle,
        }


class EtapaPrevalidacion:
    """Agrupa controles de prevalidación en una etapa lógica del proceso."""
    def __init__(
        self,
        numero: int,
        titulo: str,
        descripcion: str,
        estado: ESTADO = "NO_EJECUTADA",
        controles: Optional[list] = None,
        resumen: Optional[str] = None,
    ):
        self.numero = numero
        self.titulo = titulo
        self.descripcion = descripcion
        self.estado = estado
        self.controles = controles or []
        self.resumen = resumen

    def agregar_control(self, control: ControlPrevalidacion) -> None:
        """Agrega un control a la etapa."""
        self.controles.append(control)

    def calcular_estado(self) -> None:
        """Recalcula el estado de la etapa según los controles actuales."""
        if not self.controles:
            self.estado = "NO_EJECUTADA"
            return
        if any(c.estado == "FAIL" for c in self.controles):
            self.estado = "FAIL"
        elif any(c.estado == "WARNING" for c in self.controles):
            self.estado = "WARNING"
        else:
            self.estado = "PASS"

    def to_dict(self) -> dict:
        """Convierte la etapa y sus controles a diccionario serializable."""
        return {
            "numero": self.numero,
            "titulo": self.titulo,
            "descripcion": self.descripcion,
            "estado": self.estado,
            "controles": [c.to_dict() for c in self.controles],
            "resumen": self.resumen,
        }




class ServicioPrevalidacionAduanera:
    """Orquesta las 7 etapas de prevalidación aduanera sobre una factura."""

    @staticmethod
    def etapa1_validacion_formal(doc: dict) -> EtapaPrevalidacion:
        """Valida que la factura tenga datos mínimos obligatorios."""
        etapa = EtapaPrevalidacion(
            numero=1,
            titulo="Validación Documental y Formal",
            descripcion="Verifica que la factura contenga todos los datos mínimos obligatorios para su admisibilidad.",
        )
        numero = doc.get("numero_factura") or ""
        etapa.agregar_control(ControlPrevalidacion(
            "numero_factura",
            "FAIL" if not numero.strip() else "PASS",
            "Número de factura no detectado." if not numero.strip() else f"Número de factura: {numero}",
        ))
        fecha = doc.get("fecha_emision") or ""
        etapa.agregar_control(ControlPrevalidacion(
            "fecha_emision",
            "FAIL" if not fecha else "PASS",
            "Fecha de emisión no detectada." if not fecha else f"Fecha de emisión: {fecha}",
        ))
        moneda = doc.get("moneda") or ""
        etapa.agregar_control(ControlPrevalidacion(
            "moneda",
            "FAIL" if not moneda.strip() else "PASS",
            "Moneda no detectada." if not moneda.strip() else f"Moneda: {moneda}",
        ))
        incoterm = doc.get("incoterm") or ""
        etapa.agregar_control(ControlPrevalidacion(
            "incoterm",
            "FAIL" if not incoterm.strip() else "PASS",
            "Incoterm no declarado." if not incoterm.strip() else f"Incoterm: {incoterm}",
        ))
        monto = _float(doc.get("monto_total"))
        etapa.agregar_control(ControlPrevalidacion(
            "monto_total",
            "FAIL" if monto <= 0 else "PASS",
            "Monto total inválido o cero." if monto <= 0 else f"Monto total: {monto} {doc.get('moneda', 'USD')}",
        ))
        emisor = doc.get("emisor") or {}
        emisor_nombre = emisor.get("nombre") or ""
        etapa.agregar_control(ControlPrevalidacion(
            "emisor_nombre",
            "WARNING" if not emisor_nombre else "PASS",
            "Nombre del exportador no detectado." if not emisor_nombre else f"Exportador: {emisor_nombre}",
        ))
        receptor = doc.get("receptor") or {}
        receptor_rut = receptor.get("tax_id") or doc.get("receptor_tax_id") or ""
        receptor_pais = doc.get("receptor_pais") or receptor.get("pais") or ""
        if "CHILE" in receptor_pais.upper() or "CL" == receptor_pais.upper():
            etapa.agregar_control(ControlPrevalidacion(
                "receptor_rut_chile",
                "FAIL" if not receptor_rut else "PASS",
                "Falta RUT del importador (obligatorio para Chile)." if not receptor_rut else f"RUT importador: {receptor_rut}",
            ))
        etapa.calcular_estado()
        etapa.resumen = (
            f"{sum(1 for c in etapa.controles if c.estado == 'PASS')} de {len(etapa.controles)} controles OK"
        )
        return etapa

    @staticmethod
    def etapa2_validacion_cif(doc: dict) -> EtapaPrevalidacion:
        """Verifica el cálculo CIF (FOB+Flete+Seguro+Otros) y asignación de partidas."""
        etapa = EtapaPrevalidacion(
            numero=2,
            titulo="Validación Comercial CIF + SQUARE",
            descripcion="Verifica el cálculo aritmético aduanero (FOB + Flete + Seguro + Otros = CIF) y asigna la partida arancelaria correcta.",
        )
        subtotal = _float(doc.get("monto_subtotal") or doc.get("subtotal"))
        flete = _float(doc.get("monto_flete") or doc.get("flete"))
        seguro = _float(doc.get("monto_seguro") or doc.get("seguro"))
        otros = _float(doc.get("monto_otros_gastos") or doc.get("otros_gastos"))
        total = _float(doc.get("monto_total") or doc.get("total"))

        calculado = subtotal + flete + seguro + otros
        diff = abs(calculado - total)
        tolerancia = 2.00
        if total > 0:
            etapa.agregar_control(ControlPrevalidacion(
                "cuadre_aritmetico",
                "FAIL" if diff > tolerancia else "WARNING" if diff > 0.50 else "PASS",
                f"Subtotal({subtotal}) + Flete({flete}) + Seguro({seguro}) + Otros({otros}) = {calculado:.2f} vs Total({total:.2f}). Diferencia: {diff:.2f} (tolerancia: {tolerancia})."
                if diff > tolerancia
                else f"CIF cuadrado correcto. {calculado:.2f} ≈ {total:.2f} (diff: {diff:.2f})",
                detalle=f"subtotal={subtotal}, flete={flete}, seguro={seguro}, otros={otros}, calculado={calculado:.2f}, total={total:.2f}, diff={diff:.2f}",
            ))
        else:
            etapa.agregar_control(ControlPrevalidacion(
                "cuadre_aritmetico", "FAIL", "Total CIF es cero o no disponible. No se puede verificar cuadre."
            ))

        detalles = doc.get("detalles") or []
        items_sin_partida = sum(
            1 for d in detalles
            if not (d.get("partida_arancelaria_corregida") or d.get("partida_arancelaria") or "").strip()
        )
        total_items = len(detalles)
        if total_items > 0:
            etapa.agregar_control(ControlPrevalidacion(
                "asignacion_partida",
                "FAIL" if items_sin_partida == total_items else "WARNING" if items_sin_partida > 0 else "PASS",
                f"{items_sin_partida} de {total_items} ítems sin partida arancelaria asignada."
                if items_sin_partida > 0
                else f"Todos los {total_items} ítems tienen partida arancelaria.",
            ))

        incoterm = (doc.get("incoterm") or "").upper()
        if incoterm == "CIF" and (flete <= 0 or seguro <= 0):
            etapa.agregar_control(ControlPrevalidacion(
                "cif_flete_seguro",
                "FAIL",
                f"Incoterm CIF declarado pero flete={flete} y/o seguro={seguro} son cero.",
            ))
        elif incoterm == "FOB" and (flete > 0 or seguro > 0):
            etapa.agregar_control(ControlPrevalidacion(
                "fob_cargos_extra",
                "WARNING",
                f"Incoterm FOB con flete({flete}) y/o seguro({seguro}) > 0. Verificar que el total no los incluya.",
            ))
        etapa.calcular_estado()
        exitosos = sum(1 for c in etapa.controles if c.estado == "PASS")
        etapa.resumen = f"{exitosos} de {len(etapa.controles)} controles OK"
        return etapa

    @staticmethod
    def etapa3_validacion_normativa(doc: dict) -> EtapaPrevalidacion:
        """Cruza partidas arancelarias contra entidades fiscalizadoras para identificar permisos."""
        etapa = EtapaPrevalidacion(
            numero=3,
            titulo="Validación Normativa (Vistos Buenos)",
            descripcion="Cruza cada partida arancelaria contra el catálogo de entidades fiscalizadoras para identificar permisos requeridos.",
        )
        detalles = doc.get("detalles") or []
        vistos_buenos_aprobados = set(doc.get("vistos_buenos_aprobados") or [])
        if not detalles:
            etapa.agregar_control(ControlPrevalidacion(
                "detalles_disponibles", "FAIL", "No hay detalles (ítems) en la factura para evaluar requisitos regulatorios."
            ))
            etapa.calcular_estado()
            return etapa
        entidades_requeridas = {}
        items_sin_partida = 0
        for item in detalles:
            partida = item.get("partida_arancelaria_corregida") or item.get("partida_arancelaria") or ""
            if not partida.strip() or partida in ("0000.00.00.00",):
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
                            "partidas": set(),
                        }
                    entidades_requeridas[clave]["partidas"].add(partida)
        if items_sin_partida == len(detalles):
            etapa.agregar_control(ControlPrevalidacion(
                "partidas_disponibles", "WARNING",
                "Ningún ítem tiene partida arancelaria asignada. No es posible determinar requisitos regulatorios."
            ))
            etapa.calcular_estado()
            return etapa
        if not entidades_requeridas:
            etapa.agregar_control(ControlPrevalidacion(
                "entidades_requeridas", "PASS",
                "Ninguna partida requiere permisos regulatorios especiales."
            ))
            etapa.calcular_estado()
            return etapa
        permisos_faltantes = [
            e for e in entidades_requeridas.values()
            if e["entidad"] not in vistos_buenos_aprobados
        ]
        if not permisos_faltantes:
            etapa.agregar_control(ControlPrevalidacion(
                "permisos_cubiertos", "PASS",
                f"Todos los V°B° regulatorios están cubiertos ({len(entidades_requeridas)} entidades)."
            ))
        else:
            entidades_str = ", ".join(
                f"{e['entidad']} ({e['tipo_permiso']})" for e in permisos_faltantes[:5]
            )
            if len(permisos_faltantes) > 5:
                entidades_str += f" y {len(permisos_faltantes) - 5} más"
            etapa.agregar_control(ControlPrevalidacion(
                "permisos_faltantes",
                "FAIL" if len(permisos_faltantes) > 2 else "WARNING",
                f"Faltan {len(permisos_faltantes)} permiso(s): {entidades_str}. Gestionar antes del despacho.",
                detalle=str([p["entidad"] for p in permisos_faltantes]),
            ))
        etapa.calcular_estado()
        etapa.resumen = (
            f"{len(entidades_requeridas)} entidad(es) identificada(s), "
            f"{len(permisos_faltantes)} permiso(s) pendiente(s)"
            if entidades_requeridas else "Sin requisitos regulatorios"
        )
        return etapa

    @staticmethod
    def etapa4_validacion_pesos(doc: dict, packing_list: Optional[dict] = None, bl: Optional[dict] = None) -> EtapaPrevalidacion:
        """Cruza pesos, bultos y cantidades entre Factura, Packing List y BL."""
        etapa = EtapaPrevalidacion(
            numero=4,
            titulo="Validación de Pesos, Bultos y Cantidades",
            descripcion="Cruza peso bruto, número de bultos y cantidades entre Factura, Packing List y BL/AWB.",
        )
        factura_peso = _float(
            _obtener_valor(doc, "peso_bruto") or
            _obtener_valor(doc.get("pesos", {}), "bruto") or
            _obtener_valor(doc.get("logistica", {}), "peso_bruto")
        )
        factura_bultos = _float(doc.get("bultos") or doc.get("numero_bultos") or doc.get("total_bultos"))

        pl_peso = None
        pl_bultos = None
        if packing_list:
            pl_peso = _float(
                _obtener_valor(packing_list, "peso_bruto") or
                _obtener_valor(packing_list.get("pesos", {}), "bruto") or
                _obtener_valor(packing_list.get("logistica", {}), "peso_bruto")
            )
            pl_bultos = _float(packing_list.get("bultos") or packing_list.get("numero_bultos") or packing_list.get("total_bultos"))

        bl_peso = None
        bl_bultos = None
        if bl:
            bl_peso = _float(
                _obtener_valor(bl, "peso_bruto") or
                _obtener_valor(bl.get("pesos", {}), "bruto") or
                _obtener_valor(bl.get("logistica", {}), "peso_bruto")
            )
            bl_bultos = _float(bl.get("bultos") or bl.get("numero_bultos") or bl.get("total_bultos"))

        tolerancia_kg = 5.0
        tolerancia_bultos = 1

        if factura_peso > 0 and bl_peso and bl_peso > 0:
            diff_peso = abs(factura_peso - bl_peso)
            pct_peso = (diff_peso / max(factura_peso, bl_peso)) * 100 if max(factura_peso, bl_peso) > 0 else 0
            if diff_peso <= tolerancia_kg:
                etapa.agregar_control(ControlPrevalidacion(
                    "peso_factura_vs_bl", "PASS",
                    f"Peso bruto Factura({factura_peso}kg) ≈ BL({bl_peso}kg). Diff: {diff_peso:.1f}kg.",
                ))
            elif pct_peso > 10:
                etapa.agregar_control(ControlPrevalidacion(
                    "peso_factura_vs_bl", "FAIL",
                    f"Peso bruto Factura({factura_peso}kg) vs BL({bl_peso}kg). Diferencia > 10% ({pct_peso:.1f}%).",
                ))
            else:
                etapa.agregar_control(ControlPrevalidacion(
                    "peso_factura_vs_bl", "WARNING",
                    f"Peso bruto Factura({factura_peso}kg) vs BL({bl_peso}kg). Diff: {diff_peso:.1f}kg.",
                ))
        elif bl_peso and bl_peso > 0:
            etapa.agregar_control(ControlPrevalidacion(
                "peso_factura_vs_bl", "WARNING",
                f"Peso bruto no disponible en Factura ({factura_peso}). Usar BL ({bl_peso}kg).",
            ))

        if pl_peso and pl_peso > 0 and bl_peso and bl_peso > 0:
            diff = abs(pl_peso - bl_peso)
            if diff <= tolerancia_kg:
                etapa.agregar_control(ControlPrevalidacion(
                    "peso_pl_vs_bl", "PASS",
                    f"Peso Packing List({pl_peso}kg) ≈ BL({bl_peso}kg).",
                ))
            else:
                etapa.agregar_control(ControlPrevalidacion(
                    "peso_pl_vs_bl", "WARNING",
                    f"Peso Packing List({pl_peso}kg) ≠ BL({bl_peso}kg). Diff: {diff}kg.",
                ))

        if factura_bultos > 0 and bl_bultos and bl_bultos > 0:
            diff_b = abs(factura_bultos - bl_bultos)
            if diff_b <= tolerancia_bultos:
                etapa.agregar_control(ControlPrevalidacion(
                    "bultos_factura_vs_bl", "PASS",
                    f"Bultos Factura({int(factura_bultos)}) ≈ BL({int(bl_bultos)}).",
                ))
            else:
                etapa.agregar_control(ControlPrevalidacion(
                    "bultos_factura_vs_bl", "FAIL",
                    f"Bultos Factura({int(factura_bultos)}) ≠ BL({int(bl_bultos)}). Diferencia > {tolerancia_bultos}.",
                ))
        elif pl_bultos and pl_bultos > 0 and bl_bultos and bl_bultos > 0:
            diff_b = abs(pl_bultos - bl_bultos)
            if diff_b <= tolerancia_bultos:
                etapa.agregar_control(ControlPrevalidacion(
                    "bultos_pl_vs_bl", "PASS",
                    f"Bultos Packing List({int(pl_bultos)}) ≈ BL({int(bl_bultos)}).",
                ))
            else:
                etapa.agregar_control(ControlPrevalidacion(
                    "bultos_pl_vs_bl", "FAIL",
                    f"Bultos Packing List({int(pl_bultos)}) ≠ BL({int(bl_bultos)}).",
                ))

        detalles_factura = doc.get("detalles") or []
        detalles_pl = packing_list.get("detalles", []) if packing_list else []
        if detalles_factura and detalles_pl:
            qty_factura = sum(_float(d.get("cantidad")) for d in detalles_factura)
            qty_pl = sum(_float(d.get("cantidad")) for d in detalles_pl)
            if qty_factura > 0 and qty_pl > 0:
                diff_q = abs(qty_factura - qty_pl)
                pct_q = (diff_q / max(qty_factura, qty_pl)) * 100
                if pct_q <= 5:
                    etapa.agregar_control(ControlPrevalidacion(
                        "cantidad_total", "PASS",
                        f"Cantidad total Factura({qty_factura:.0f}) ≈ Packing List({qty_pl:.0f}).",
                    ))
                else:
                    etapa.agregar_control(ControlPrevalidacion(
                        "cantidad_total", "FAIL" if pct_q > 10 else "WARNING",
                        f"Cantidad total Factura({qty_factura:.0f}) vs Packing List({qty_pl:.0f}). Diff: {pct_q:.1f}%.",
                    ))

        if doc.get("emisor") and bl and bl.get("shipper"):
            nom_factura = (doc["emisor"].get("nombre") or "").strip().lower()
            nom_bl = (bl["shipper"].get("nombre") or bl["shipper"].get("name") or "").strip().lower()
            if nom_factura and nom_bl:
                ratio = SequenceMatcher(None, nom_factura, nom_bl).ratio()
                if ratio >= 0.75:
                    etapa.agregar_control(ControlPrevalidacion(
                        "identidad_proveedor", "PASS",
                        f"Nombre del proveedor coincide entre Factura y BL (similitud: {ratio:.0%}).",
                    ))
                else:
                    etapa.agregar_control(ControlPrevalidacion(
                        "identidad_proveedor", "FAIL",
                        f"Nombre del proveedor NO coincide: '{nom_factura}' vs '{nom_bl}' (similitud: {ratio:.0%}).",
                    ))
        etapa.calcular_estado()
        exitosos = sum(1 for c in etapa.controles if c.estado == "PASS")
        etapa.resumen = f"{exitosos} de {len(etapa.controles)} controles OK"
        return etapa

    @staticmethod
    def etapa5_validacion_valoracion(doc: dict) -> EtapaPrevalidacion:
        """Verifica Incoterm, ajustes al valor aduanero y vinculación."""
        etapa = EtapaPrevalidacion(
            numero=5,
            titulo="Validación de Regímenes y Valoración",
            descripcion="Verifica consistencia del Incoterm, ajustes al valor aduanero (royalties, descuentos, comisiones) y relación comprador-vendedor.",
        )
        incoterm = (doc.get("incoterm") or "").upper()
        detalles = doc.get("detalles") or []
        moneda = doc.get("moneda") or "USD"

        if incoterm:
            if incoterm not in INCOTERMS_VALIDOS:
                etapa.agregar_control(ControlPrevalidacion(
                    "incoterm_valido", "FAIL",
                    f"Incoterm '{incoterm}' no reconocido en Incoterms 2020.",
                ))
            else:
                etapa.agregar_control(ControlPrevalidacion(
                    "incoterm_valido", "PASS",
                    f"Incoterm '{incoterm}' reconocido en Incoterms 2020.",
                ))

            flete = _float(doc.get("monto_flete") or doc.get("flete"))
            seguro = _float(doc.get("monto_seguro") or doc.get("seguro"))
            if incoterm in INCOTERMS_SEGURO_OBLIGA:
                if seguro <= 0:
                    etapa.agregar_control(ControlPrevalidacion(
                        "seguro_obligatorio", "FAIL",
                        f"Incoterm {incoterm} exige seguro contratado por el vendedor. Seguro = {seguro}.",
                    ))
                if flete <= 0:
                    etapa.agregar_control(ControlPrevalidacion(
                        "flete_obligatorio", "FAIL",
                        f"Incoterm {incoterm} exige flete contratado por el vendedor. Flete = {flete}.",
                    ))
            elif incoterm == "EXW" and (flete > 0 or seguro > 0):
                etapa.agregar_control(ControlPrevalidacion(
                    "exw_cargos", "WARNING",
                    "EXW: flete y seguro son responsabilidad del comprador. Verificar que no estén duplicados.",
                ))
            elif incoterm == "FOB" and (flete > 0 or seguro > 0):
                etapa.agregar_control(ControlPrevalidacion(
                    "fob_cargos", "WARNING",
                    "FOB con flete/seguro incluidos. Estos deben declararse por separado para el valor CIF.",
                ))

        total = _float(doc.get("monto_total") or doc.get("total"))
        subtotal_items = sum(
            _float(d.get("cantidad", 0)) * _float(d.get("precio_unitario", 0))
            for d in detalles
        )
        if total > 0 and subtotal_items > 0:
            diff_val = abs(subtotal_items - total)
            if diff_val > 10.0 and diff_val / total > 0.02:
                etapa.agregar_control(ControlPrevalidacion(
                    "coherencia_precios", "WARNING",
                    f"Suma de items ({subtotal_items:.2f}) difiere del total ({total:.2f}) en {diff_val:.2f} {moneda}.",
                ))

        for i, d in enumerate(detalles):
            precio = _float(d.get("precio_unitario"))
            desc = d.get("descripcion_producto", "")
            if precio <= 0:
                etapa.agregar_control(ControlPrevalidacion(
                    f"precio_item_{i}", "WARNING",
                    f"Ítem '{desc}' tiene precio unitario {precio}.",
                ))

        # Descuentos y ajustes
        descuentos = doc.get("descuentos") or doc.get("discounts")
        if descuentos:
            if isinstance(descuentos, (int, float)) and descuentos > 0:
                etapa.agregar_control(ControlPrevalidacion(
                    "descuentos_documentados", "WARNING",
                    f"Descuento detectado ({descuentos} {moneda}). Verificar documentación de respaldo.",
                ))
            elif isinstance(descuentos, list) and len(descuentos) > 0:
                total_desc = sum(_float(d.get("monto", 0)) for d in descuentos if isinstance(d, dict))
                if total_desc > 0:
                    etapa.agregar_control(ControlPrevalidacion(
                        "descuentos_documentados", "WARNING",
                        f"Descuento(s) detectado(s) por {total_desc:.2f} {moneda}. Deben estar documentados.",
                    ))

        # Regalías / Asistencia técnica
        regalias = doc.get("regalias") or doc.get("royalties")
        if regalias:
            monto_reg = _float(regalias.get("monto", regalias) if isinstance(regalias, dict) else regalias)
            if monto_reg > 0:
                etapa.agregar_control(ControlPrevalidacion(
                    "regalias", "WARNING",
                    f"Regalías o asistencia técnica detectada ({monto_reg} {moneda}). Debe agregarse al valor aduanero.",
                ))

        # Relación comprador-vendedor
        relacion = doc.get("relacion_vinculacion") or doc.get("related_party")
        if relacion:
            if isinstance(relacion, str):
                relacion = relacion.lower() in ("si", "yes", "true", "1")
            if relacion:
                etapa.agregar_control(ControlPrevalidacion(
                    "vinculacion", "WARNING",
                    "Partes vinculadas detectadas. Verificar que el valor de transacción refleje el precio realmente pagado.",
                ))

        etapa.calcular_estado()
        exitosos = sum(1 for c in etapa.controles if c.estado == "PASS")
        etapa.resumen = f"{exitosos} de {len(etapa.controles)} controles OK"
        return etapa

    @staticmethod
    def etapa6_validacion_plazos(doc: dict, bl: Optional[dict] = None) -> EtapaPrevalidacion:
        """Verifica vigencia de factura, BL y póliza de seguro."""
        etapa = EtapaPrevalidacion(
            numero=6,
            titulo="Validación de Plazos y Vigencias",
            descripcion="Verifica que la factura y el BL estén dentro de plazos válidos y que los permisos estén vigentes.",
        )
        ahora = datetime.now()
        fecha_factura_str = doc.get("fecha_emision") or ""
        if fecha_factura_str:
            try:
                fmt = "%Y-%m-%d" if "T" not in fecha_factura_str else "%Y-%m-%dT%H:%M:%S"
                fecha_factura = datetime.strptime(fecha_factura_str[:19], fmt)
                dias = (ahora - fecha_factura).days
                if dias <= 60:
                    etapa.agregar_control(ControlPrevalidacion(
                        "vigencia_factura", "PASS",
                        f"Factura emitida hace {dias} día(s). Dentro del plazo de 60 días.",
                    ))
                else:
                    etapa.agregar_control(ControlPrevalidacion(
                        "vigencia_factura", "FAIL",
                        f"Factura emitida hace {dias} día(s). Excede el plazo de 60 días para numeración.",
                    ))
            except ValueError:
                etapa.agregar_control(ControlPrevalidacion(
                    "vigencia_factura", "WARNING",
                    f"Formato de fecha '{fecha_factura_str}' no reconocido. Verificar manualmente.",
                ))
        else:
            etapa.agregar_control(ControlPrevalidacion(
                "vigencia_factura", "FAIL", "Fecha de emisión no disponible. No se puede verificar vigencia."
            ))

        if bl:
            fecha_bl_str = bl.get("fecha_zarpe") or bl.get("fecha_emision") or bl.get("fecha_zarpe") or bl.get("date_of_issue") or bl.get("fecha_expedicion") or ""
            if fecha_bl_str:
                try:
                    fmt = "%Y-%m-%d" if "T" not in fecha_bl_str else "%Y-%m-%dT%H:%M:%S"
                    fecha_bl = datetime.strptime(fecha_bl_str[:19], fmt)
                    dias_bl = (ahora - fecha_bl).days
                    if dias_bl <= 30:
                        etapa.agregar_control(ControlPrevalidacion(
                            "vigencia_bl", "PASS",
                            f"BL emitido hace {dias_bl} día(s). Dentro del plazo de 30 días.",
                        ))
                    else:
                        etapa.agregar_control(ControlPrevalidacion(
                            "vigencia_bl", "WARNING",
                            f"BL emitido hace {dias_bl} día(s). Excede plazo recomendado de 30 días.",
                        ))
                except ValueError:
                    etapa.agregar_control(ControlPrevalidacion(
                        "vigencia_bl", "WARNING",
                        f"Formato de fecha BL '{fecha_bl_str}' no reconocido.",
                    ))
            else:
                etapa.agregar_control(ControlPrevalidacion(
                    "vigencia_bl", "NO_EJECUTADA",
                    "Fecha de BL no disponible para verificar vigencia.",
                ))

        # Seguro
        seguro_poliza = doc.get("seguro_poliza") or doc.get("insurance_policy")
        if isinstance(seguro_poliza, dict):
            desde = seguro_poliza.get("desde") or seguro_poliza.get("fecha_desde")
            hasta = seguro_poliza.get("hasta") or seguro_poliza.get("fecha_hasta")
            if desde and hasta:
                try:
                    fmt = "%Y-%m-%d" if "T" not in desde else "%Y-%m-%dT%H:%M:%S"
                    f_desde = datetime.strptime(desde[:19], fmt)
                    f_hasta = datetime.strptime(hasta[:19], fmt)
                    if f_desde <= ahora <= f_hasta:
                        etapa.agregar_control(ControlPrevalidacion(
                            "cobertura_seguro", "PASS",
                            "Póliza de seguro vigente (cubre la fecha actual).",
                        ))
                    else:
                        etapa.agregar_control(ControlPrevalidacion(
                            "cobertura_seguro", "FAIL",
                            "Póliza de seguro NO vigente. Fecha fuera del período de cobertura.",
                        ))
                except ValueError:
                    etapa.agregar_control(ControlPrevalidacion(
                        "cobertura_seguro", "WARNING",
                        "Formato de fecha de seguro no reconocido. Verificar manualmente.",
                    ))
            elif seguro_poliza.get("numero") or seguro_poliza.get("numero_poliza"):
                etapa.agregar_control(ControlPrevalidacion(
                    "cobertura_seguro", "WARNING",
                    "Póliza de seguro declarada pero sin fechas de cobertura. Verificar vigencia manualmente.",
                ))
        elif seguro_poliza:
            etapa.agregar_control(ControlPrevalidacion(
                "cobertura_seguro", "WARNING",
                "Seguro declarado pero sin detalle de póliza. Verificar cobertura.",
            ))

        etapa.calcular_estado()
        exitosos = sum(1 for c in etapa.controles if c.estado == "PASS")
        etapa.resumen = f"{exitosos} de {len(etapa.controles)} controles OK"
        return etapa

    @staticmethod
    def etapa7_preclasificacion_riesgo(etapas: list[EtapaPrevalidacion]) -> EtapaPrevalidacion:
        """Agrega todas las etapas en un scoring unificado de riesgo."""
        etapa = EtapaPrevalidacion(
            numero=7,
            titulo="Preclasificación de Riesgo",
            descripcion="Agrega todas las etapas anteriores en un scoring unificado de riesgo.",
        )
        pesos_etapa = {1: 10, 2: 20, 3: 20, 4: 15, 5: 20, 6: 15}
        puntaje_maximo = sum(pesos_etapa.values())
        puntaje_total = 0
        resultados_por_etapa = []
        for e in etapas:
            peso = pesos_etapa.get(e.numero, 10)
            if e.estado == "PASS":
                punt = 0
            elif e.estado == "WARNING":
                punt = peso * 0.5
            elif e.estado == "FAIL":
                punt = peso
            else:
                punt = peso * 0.2
            puntaje_total += punt
            resultados_por_etapa.append({
                "etapa": e.titulo,
                "estado": e.estado,
                "puntaje": round(punt, 1),
            })

        pct = round((puntaje_total / puntaje_maximo) * 100, 1)
        if pct <= 10:
            nivel = NivelRiesgo.BAJO.value
        elif pct <= 30:
            nivel = NivelRiesgo.MEDIO.value
        elif pct <= 65:
            nivel = NivelRiesgo.ALTO.value
        else:
            nivel = "CRITICO"

        etapa.agregar_control(ControlPrevalidacion(
            "scoring_final", "PASS" if nivel == NivelRiesgo.BAJO.value else "WARNING" if nivel == NivelRiesgo.MEDIO.value else "FAIL",
            f"Riesgo: {nivel}. Puntaje: {pct}% (máx: {puntaje_maximo}, obtenido: {puntaje_total:.1f}).",
            detalle=str({"puntaje_total": round(puntaje_total, 1), "puntaje_maximo": puntaje_maximo, "porcentaje": pct, "resultados_por_etapa": resultados_por_etapa}),
        ))
        etapa.calcular_estado()
        etapa.resumen = f"Riesgo {nivel} ({pct}%)"
        setattr(etapa, "_nivel_riesgo", nivel)
        setattr(etapa, "_puntaje_riesgo", pct)
        return etapa

    @classmethod
    def ejecutar(
        cls,
        factura: dict,
        packing_list: Optional[dict] = None,
        bl: Optional[dict] = None,
    ) -> dict:
        """Ejecuta las 7 etapas de prevalidación y retorna el resultado completo."""
        e1 = cls.etapa1_validacion_formal(factura)
        e2 = cls.etapa2_validacion_cif(factura)
        e3 = cls.etapa3_validacion_normativa(factura)
        e4 = cls.etapa4_validacion_pesos(factura, packing_list, bl)
        e5 = cls.etapa5_validacion_valoracion(factura)
        e6 = cls.etapa6_validacion_plazos(factura, bl)
        etapas = [e1, e2, e3, e4, e5, e6]
        e7 = cls.etapa7_preclasificacion_riesgo(etapas)
        etapas.append(e7)

        nivel_riesgo = getattr(e7, "_nivel_riesgo", NivelRiesgo.MEDIO.value)
        puntaje_riesgo = getattr(e7, "_puntaje_riesgo", 0)

        return {
            "riesgo_global": nivel_riesgo,
            "puntaje_riesgo": puntaje_riesgo,
            "etapas": [e.to_dict() for e in etapas],
        }
