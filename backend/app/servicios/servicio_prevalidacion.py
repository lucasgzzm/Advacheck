import logging
from typing import Optional, Literal
from datetime import datetime
from difflib import SequenceMatcher

from ..utilidades import (
    convertir_a_float as _float,
    obtener_valor_anidado as _obtener_valor,
    verificar_cuadre_cif,
    coincide_patron as _coincide_patron,
)
from ..catalogo_regulatorio import (
    ENTIDADES_POR_PARTIDA,
    INCOTERMS_VALIDOS,
    INCOTERMS_SEGURO_OBLIGA,
    MONEDAS_VALIDAS,
    normalizar_partida as _normalizar_partida,
)
from ..modelos import NivelRiesgo

logger = logging.getLogger(__name__)

ESTADO = Literal["PASS", "WARNING", "FAIL", "NO_EJECUTADA", "PENDIENTE"]

# Resultado de un control individual dentro de una etapa de prevalidacion
class ControlPrevalidacion:
    def __init__(self, nombre: str, estado: ESTADO, mensaje: str, detalle: Optional[str] = None):
        self.nombre = nombre
        self.estado = estado
        self.mensaje = mensaje
        self.detalle = detalle

    # Convierte el control a diccionario para serializar
    def to_dict(self) -> dict:
        return {
            "nombre": self.nombre,
            "estado": self.estado,
            "mensaje": self.mensaje,
            "detalle": self.detalle,
        }

# Etapa compuesta por multiples controles de validacion
class EtapaPrevalidacion:
    def __init__(
        self,
        numero: int,
        titulo: str,
        descripcion: str,
        estado: ESTADO = "NO_EJECUTADA",
        controles: Optional[list] = None,
        resumen: Optional[str] = None,
        peso: int = 0,
        contribucion: float = 0.0,
    ):
        self.numero = numero
        self.titulo = titulo
        self.descripcion = descripcion
        self.estado = estado
        self.controles = controles or []
        self.resumen = resumen
        self.peso = peso
        self.contribucion = contribucion

    # Agrega un control a la etapa
    def agregar_control(self, control: ControlPrevalidacion) -> None:
        self.controles.append(control)

    # Calcula el estado consolidado de la etapa segun sus controles
    def calcular_estado(self) -> None:
        if not self.controles:
            self.estado = "NO_EJECUTADA"
            return
        if any(c.estado == "FAIL" for c in self.controles):
            self.estado = "FAIL"
        elif any(c.estado == "PENDIENTE" for c in self.controles):
            self.estado = "PENDIENTE"
        elif any(c.estado == "WARNING" for c in self.controles):
            self.estado = "WARNING"
        else:
            self.estado = "PASS"

    # Convierte la etapa a diccionario para serializar
    def to_dict(self) -> dict:
        return {
            "numero": self.numero,
            "titulo": self.titulo,
            "descripcion": self.descripcion,
            "estado": self.estado,
            "controles": [c.to_dict() for c in self.controles],
            "resumen": self.resumen,
            "peso": self.peso,
            "contribucion": self.contribucion,
        }

# Patrones de validacion para campos comunes en facturas de comercio exterior
PATRONES_CONFIANZA = {
    "numero_factura": r'^[A-Za-z0-9][A-Za-z0-9\-\/\.\#]{1,30}$',
    "moneda": r'^[A-Z]{3}$',
    "incoterm": r'^(FOB|CIF|CFR|CPT|CIP|EXW|FCA|FAS|DAT|DAP|DDP)$',
    "email": r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
    "tax_id": r'^[A-Za-z0-9\.\-]{4,20}$',
}

# Evalua la confianza de cada campo extraido de la factura
def evaluar_confianza_extraccion(datos: dict) -> dict:
    confianza = {}
    base = 85

    nf = (datos.get("numero_factura") or "").strip()
    if not nf or nf in ("N/A", "NA", "n/a", "S/N", "0"):
        confianza["numero_factura"] = 15
    elif _coincide_patron(nf, PATRONES_CONFIANZA["numero_factura"]):
        confianza["numero_factura"] = base
    elif len(nf) >= 4:
        confianza["numero_factura"] = 60
    else:
        confianza["numero_factura"] = 35

    mt = _float(datos.get("monto_total") or datos.get("monto_total_cif"))
    if mt <= 0:
        confianza["monto_total"] = 10
    elif mt > 100_000_000:
        confianza["monto_total"] = 60
    else:
        confianza["monto_total"] = base

    st = _float(datos.get("monto_subtotal"))
    confianza["monto_subtotal"] = base if st > 0 else 40

    fl = _float(datos.get("monto_flete"))
    if fl < 0:
        confianza["monto_flete"] = 20
    else:
        confianza["monto_flete"] = base

    sg = _float(datos.get("monto_seguro"))
    if sg < 0:
        confianza["monto_seguro"] = 20
    else:
        confianza["monto_seguro"] = base

    inc = (datos.get("incoterm") or "").strip().upper()
    if not inc:
        confianza["incoterm"] = 70
    elif _coincide_patron(inc, PATRONES_CONFIANZA["incoterm"]):
        confianza["incoterm"] = base
    else:
        confianza["incoterm"] = 40

    mon = (datos.get("moneda") or "").strip().upper()
    if not mon:
        confianza["moneda"] = 20
    elif mon in MONEDAS_VALIDAS:
        confianza["moneda"] = base
    else:
        confianza["moneda"] = 50

    fe = datos.get("fecha_emision") or ""
    if not fe:
        confianza["fecha_emision"] = 15
    else:
        try:
            fe_str = str(fe).strip()
            if "T" in fe_str:
                datetime.strptime(fe_str[:19], "%Y-%m-%dT%H:%M:%S")
            elif "/" in fe_str:
                datetime.strptime(fe_str, "%d/%m/%Y")
            elif "-" in fe_str:
                datetime.strptime(fe_str, "%Y-%m-%d")
            else:
                raise ValueError
            confianza["fecha_emision"] = base
        except (ValueError, TypeError):
            confianza["fecha_emision"] = 40

    po = datos.get("pais_origen") or ""
    confianza["pais_origen"] = base if len(po) >= 2 else 30

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

    suma_items = sum(
        _float(d.get("cantidad", 0)) * _float(d.get("precio_unitario", 0))
        for d in detalles
    )
    flete = _float(datos.get("monto_flete"))
    seguro = _float(datos.get("monto_seguro"))
    otros = _float(datos.get("monto_otros_gastos"))
    suma_con_gastos = suma_items + flete + seguro + otros
    if mt > 0 and suma_con_gastos > 0:
        diff = abs(round(suma_con_gastos - mt, 2))
        if diff <= 0.1:
            confianza["cuadratura_items"] = 100
        else:
            diff_pct = diff / mt * 100
            confianza["cuadratura_items"] = round(max(20, 100 - diff_pct * 2), 1)

    if datos.get("validacion_error"):
        for k in confianza:
            confianza[k] = min(confianza[k], 70)

    return confianza

# Verifica que la suma de items + flete + seguro + otros coincida con el total CIF
def verificar_cuadratura_items(datos: dict) -> dict:
    detalles = datos.get("detalles") or []
    moneda = datos.get("moneda") or "USD"
    if not detalles:
        return {"ejecutado": False, "mensaje": "No hay detalles (items) en la factura.", "items": []}

    suma_items = sum(
        _float(d.get("cantidad", 0)) * _float(d.get("precio_unitario", 0))
        for d in detalles
    )
    flete = _float(datos.get("monto_flete"))
    seguro = _float(datos.get("monto_seguro"))
    otros = _float(datos.get("monto_otros_gastos"))
    suma_con_gastos = suma_items + flete + seguro + otros
    total_cif = _float(datos.get("monto_total") or datos.get("monto_total_cif"))
    subtotal_declarado = _float(datos.get("monto_subtotal") or datos.get("subtotal"))

    diff = abs(round(suma_con_gastos - total_cif, 2))
    diff_pct = round(diff / total_cif * 100, 1) if total_cif > 0 else 0
    coincide = diff <= 0.1
    estado = "PASS" if coincide else "WARNING" if diff_pct <= 5 else "FAIL"

    items_detalle = []
    for i, d in enumerate(detalles):
        cant = _float(d.get("cantidad"))
        pu = _float(d.get("precio_unitario"))
        items_detalle.append({
            "indice": i,
            "descripcion": (d.get("descripcion_producto") or f"Item #{i+1}")[:60],
            "cantidad": cant,
            "precio_unitario": pu,
            "subtotal_calculado": round(cant * pu, 2),
        })

    if coincide:
        msg = (
            f"Items ({suma_items:.2f}) + Flete ({flete:.2f}) + Seguro ({seguro:.2f}) + "
            f"Otros ({otros:.2f}) = {suma_con_gastos:.2f} == Total CIF ({total_cif:.2f}) {moneda}. "
            f"Cuadrado correctamente."
        )
    else:
        msg = (
            f"Items ({suma_items:.2f}) + Flete ({flete:.2f}) + Seguro ({seguro:.2f}) + Otros ({otros:.2f}) "
            f"= {suma_con_gastos:.2f} != Total CIF ({total_cif:.2f}) {moneda}. "
            f"Diferencia: {diff:.2f} ({diff_pct:.1f}%)."
        )

    return {
        "ejecutado": True,
        "tipo_comparacion": "total_cif",
        "subtotal_declarado": round(subtotal_declarado, 2) if subtotal_declarado > 0 else None,
        "total_cif_declarado": round(total_cif, 2) if total_cif > 0 else None,
        "suma_items": round(suma_items, 2),
        "flete": round(flete, 2),
        "seguro": round(seguro, 2),
        "otros": round(otros, 2),
        "suma_con_gastos": round(suma_con_gastos, 2),
        "diferencia": round(diff, 2),
        "diferencia_porcentaje": round(diff_pct, 1),
        "moneda": moneda,
        "coincide": coincide,
        "estado": estado,
        "mensaje": msg,
        "items": items_detalle,
    }

def etapa1_validacion_formal(doc: dict) -> EtapaPrevalidacion:
    etapa = EtapaPrevalidacion(
        numero=1,
        titulo="Validacion Documental y Formal",
        descripcion="Verifica que la factura contenga todos los datos minimos obligatorios para su admisibilidad.",
    )
    numero = doc.get("numero_factura") or ""
    etapa.agregar_control(ControlPrevalidacion(
        "numero_factura",
        "FAIL" if not numero.strip() else "PASS",
        "Numero de factura no detectado." if not numero.strip() else f"Numero de factura: {numero}",
    ))
    fecha = doc.get("fecha_emision") or ""
    etapa.agregar_control(ControlPrevalidacion(
        "fecha_emision",
        "FAIL" if not fecha else "PASS",
        "Fecha de emision no detectada." if not fecha else f"Fecha de emision: {fecha}",
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
        "WARNING" if not incoterm.strip() else "PASS",
        "Incoterm no declarado (comun en boletas simplificadas)." if not incoterm.strip() else f"Incoterm: {incoterm}",
    ))
    monto = _float(doc.get("monto_total") or doc.get("monto_total_cif"))
    etapa.agregar_control(ControlPrevalidacion(
        "monto_total",
        "FAIL" if monto <= 0 else "PASS",
        "El monto total o el valor CIF es cero o no esta disponible." if monto <= 0 else f"Monto total: {monto} {doc.get('moneda', 'USD')}",
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

def etapa2_validacion_cif(doc: dict) -> EtapaPrevalidacion:
    etapa = EtapaPrevalidacion(
        numero=2,
        titulo="Validacion Comercial CIF + SQUARE",
        descripcion="Verifica el calculo aritmetico aduanero (FOB + Flete + Seguro + Otros = CIF) y asigna partidas arancelarias.",
    )
    subtotal = _float(doc.get("monto_subtotal") or doc.get("subtotal"))
    flete = _float(doc.get("monto_flete") or doc.get("flete"))
    seguro = _float(doc.get("monto_seguro") or doc.get("seguro"))
    otros = _float(doc.get("monto_otros_gastos") or doc.get("otros_gastos"))
    total = _float(doc.get("monto_total") or doc.get("monto_total_cif") or doc.get("total"))

    tolerancia = max(2.0, total * 0.02) if total > 0 else 2.0
    cuadra, diff, mensaje = verificar_cuadre_cif(subtotal, flete, seguro, otros, total, tolerancia=tolerancia)
    if diff <= 0.50:
        estado_cuadre = "PASS"
    elif diff <= tolerancia:
        estado_cuadre = "WARNING"
    else:
        estado_cuadre = "FAIL"
    etapa.agregar_control(ControlPrevalidacion(
        "cuadre_aritmetico", estado_cuadre, mensaje,
        detalle=f"subtotal={subtotal}, flete={flete}, seguro={seguro}, otros={otros}, diff={diff:.2f}",
    ))

    detalles = doc.get("detalles") or []
    items_sin_partida = sum(
        1 for d in detalles
        if not (d.get("partida_arancelaria_corregida") or d.get("partida_arancelaria") or d.get("partida_arancelaria_sugerida") or "").strip()
    )
    total_items = len(detalles)
    if total_items > 0:
        etapa.agregar_control(ControlPrevalidacion(
            "asignacion_partida",
            "FAIL" if items_sin_partida == total_items else "WARNING" if items_sin_partida > 0 else "PASS",
            f"{items_sin_partida} de {total_items} items sin partida arancelaria asignada."
            if items_sin_partida > 0
            else f"Todos los {total_items} items tienen partida arancelaria.",
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

# Busca entidades fiscalizadoras asociadas a una partida arancelaria
def _detectar_permisos_por_partida(partida: str) -> list[dict]:
    codigo = _normalizar_partida(partida)
    if not codigo:
        return []
    encontrados = []
    for regla in ENTIDADES_POR_PARTIDA:
        if regla["rango_desde"] <= codigo <= regla["rango_hasta"]:
            encontrados.append(regla)
    return encontrados

def etapa3_validacion_normativa(doc: dict) -> EtapaPrevalidacion:
    etapa = EtapaPrevalidacion(
        numero=3,
        titulo="Validacion Normativa (Vistos Buenos)",
        descripcion="Evalua cada partida arancelaria contra el catalogo de entidades fiscalizadoras chilenas para identificar permisos requeridos.",
    )
    items = doc.get("detalles") or []
    if not items:
        etapa.agregar_control(ControlPrevalidacion(
            "detalles_disponibles", "FAIL", "No hay items en la factura para evaluar requisitos regulatorios."
        ))
        etapa.calcular_estado()
        return etapa

    permisos_aprobados = set()
    for pa in doc.get("permisos_aprobados") or []:
        permisos_aprobados.add((pa.get("entidad"), pa.get("tipo_permiso")))

    permisos_requeridos = {}
    items_sin_partida = 0
    for item in items:
        partida = (item.get("partida_arancelaria_corregida")
                   or item.get("partida_arancelaria")
                   or item.get("partida_arancelaria_sugerida")
                   or "")
        if not partida.strip() or partida in ("0000.00.00.00",):
            items_sin_partida += 1
            continue
        for regla in _detectar_permisos_por_partida(partida):
            clave = (regla["entidad"], regla["tipo"])
            if clave in permisos_aprobados:
                continue
            if clave not in permisos_requeridos:
                permisos_requeridos[clave] = {
                    "entidad": regla["entidad"],
                    "tipo_permiso": regla["tipo"],
                    "partidas": set(),
                }
            permisos_requeridos[clave]["partidas"].add(partida)

    if items_sin_partida == len(items):
        etapa.agregar_control(ControlPrevalidacion(
            "partidas_disponibles", "WARNING",
            "Ningun item tiene partida arancelaria. No es posible determinar requisitos regulatorios."
        ))
        etapa.calcular_estado()
        return etapa

    if not permisos_requeridos:
        etapa.agregar_control(ControlPrevalidacion(
            "entidades_requeridas", "PASS",
            "Ninguna partida requiere permisos regulatorios especiales."
        ))
        etapa.calcular_estado()
        return etapa

    permisos_lista = list(permisos_requeridos.values())
    entidades_str = ", ".join(
        f"{p['entidad']} ({p['tipo_permiso']})" for p in permisos_lista[:5]
    )
    if len(permisos_lista) > 5:
        entidades_str += f" y {len(permisos_lista) - 5} mas"

    etapa.agregar_control(ControlPrevalidacion(
        "permisos_faltantes",
        "FAIL" if len(permisos_lista) > 2 else "WARNING",
        f"Faltan {len(permisos_lista)} permiso(s): {entidades_str}. Gestionar antes del despacho.",
        detalle=str([p["entidad"] for p in permisos_lista]),
    ))
    etapa.calcular_estado()
    etapa.resumen = (
        f"{len(permisos_requeridos)} entidad(es) identificada(s), "
        f"{len(permisos_lista)} permiso(s) pendiente(s)"
    )
    return etapa

def etapa4_validacion_pesos(doc: dict, packing_list: Optional[dict] = None, bl: Optional[dict] = None) -> EtapaPrevalidacion:
    etapa = EtapaPrevalidacion(
        numero=4,
        titulo="Validacion de Pesos, Bultos y Cantidades",
        descripcion="Cruza peso bruto, numero de bultos y cantidades entre Factura, Packing List y BL/AWB.",
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
                f"Peso bruto Factura({factura_peso}kg) aprox. BL({bl_peso}kg). Diff: {diff_peso:.1f}kg.",
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
                f"Peso Packing List({pl_peso}kg) aprox. BL({bl_peso}kg).",
            ))
        else:
            etapa.agregar_control(ControlPrevalidacion(
                "peso_pl_vs_bl", "WARNING",
                f"Peso Packing List({pl_peso}kg) != BL({bl_peso}kg). Diff: {diff}kg.",
            ))

    if factura_bultos > 0 and bl_bultos and bl_bultos > 0:
        diff_b = abs(factura_bultos - bl_bultos)
        if diff_b <= tolerancia_bultos:
            etapa.agregar_control(ControlPrevalidacion(
                "bultos_factura_vs_bl", "PASS",
                f"Bultos Factura({int(factura_bultos)}) aprox. BL({int(bl_bultos)}).",
            ))
        else:
            etapa.agregar_control(ControlPrevalidacion(
                "bultos_factura_vs_bl", "FAIL",
                f"Bultos Factura({int(factura_bultos)}) != BL({int(bl_bultos)}). Diferencia > {tolerancia_bultos}.",
            ))
    elif pl_bultos and pl_bultos > 0 and bl_bultos and bl_bultos > 0:
        diff_b = abs(pl_bultos - bl_bultos)
        if diff_b <= tolerancia_bultos:
            etapa.agregar_control(ControlPrevalidacion(
                "bultos_pl_vs_bl", "PASS",
                f"Bultos Packing List({int(pl_bultos)}) aprox. BL({int(bl_bultos)}).",
            ))
        else:
            etapa.agregar_control(ControlPrevalidacion(
                "bultos_pl_vs_bl", "FAIL",
                f"Bultos Packing List({int(pl_bultos)}) != BL({int(bl_bultos)}).",
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
                    f"Cantidad total Factura({qty_factura:.0f}) aprox. Packing List({qty_pl:.0f}).",
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
    if factura_peso > 0 and not bl_peso:
        etapa.agregar_control(ControlPrevalidacion(
            "peso_factura", "PENDIENTE",
            f"Peso bruto según factura: {factura_peso}kg. No hay BL/AWB para validar."
        ))
    if factura_bultos > 0 and not bl_bultos:
        etapa.agregar_control(ControlPrevalidacion(
            "bultos_factura", "PENDIENTE",
            f"Bultos según factura: {int(factura_bultos)}. No hay BL/AWB para validar."
        ))
    if detalles_factura and not detalles_pl:
        qty_total = sum(_float(d.get("cantidad")) for d in detalles_factura)
        if qty_total > 0:
            etapa.agregar_control(ControlPrevalidacion(
                "cantidad_total", "PENDIENTE",
                f"Cantidad total según factura: {qty_total:.0f} uds. No hay Packing List para validar."
            ))
    if len(etapa.controles) == 0:
        etapa.agregar_control(ControlPrevalidacion(
            "peso_bultos", "NO_EJECUTADA",
            "La factura no contiene datos de peso, bultos ni cantidades. No se puede ejecutar Etapa 4."
        ))
    etapa.calcular_estado()
    exitosos = sum(1 for c in etapa.controles if c.estado == "PASS")
    etapa.resumen = f"{exitosos} de {len(etapa.controles)} controles OK"
    return etapa

# Verifica consistencia del Incoterm, ajustes al valor aduanero y relacion comprador-vendedor
def etapa5_validacion_valoracion(doc: dict) -> EtapaPrevalidacion:
    etapa = EtapaPrevalidacion(
        numero=5,
        titulo="Validacion de Regimenes y Valoracion",
        descripcion="Verifica consistencia del Incoterm, ajustes al valor aduanero (royalties, descuentos, comisiones) y relacion comprador-vendedor.",
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
                "EXW: flete y seguro son responsabilidad del comprador. Verificar que no esten duplicados.",
            ))
        elif incoterm == "FOB" and (flete > 0 or seguro > 0):
            etapa.agregar_control(ControlPrevalidacion(
                "fob_cargos", "WARNING",
                "FOB con flete/seguro incluidos. Estos deben declararse por separado para el valor CIF.",
            ))

    total = _float(doc.get("monto_total") or doc.get("monto_total_cif") or doc.get("total"))
    subtotal_declarado = _float(doc.get("monto_subtotal") or doc.get("subtotal"))
    flete = _float(doc.get("monto_flete") or doc.get("flete"))
    seguro = _float(doc.get("monto_seguro") or doc.get("seguro"))
    otros = _float(doc.get("monto_otros_gastos") or doc.get("otros_gastos"))

    subtotal_items = sum(
        _float(d.get("cantidad", 0)) * _float(d.get("precio_unitario", 0))
        for d in detalles
    )

    if subtotal_items <= 0:
        pass
    elif subtotal_declarado > 0:
        diff_val = abs(subtotal_items - subtotal_declarado)
        if diff_val > 10.0 and diff_val / subtotal_declarado > 0.02:
            etapa.agregar_control(ControlPrevalidacion(
                "coherencia_precios", "WARNING",
                f"Suma de items ({subtotal_items:.2f}) difiere del subtotal declarado ({subtotal_declarado:.2f}) en {diff_val:.2f} {moneda}.",
            ))
    elif total > 0:
        total_esperado = subtotal_items + flete + seguro + otros
        diff_val = abs(total_esperado - total)
        if diff_val > 10.0 and diff_val / total > 0.02:
            etapa.agregar_control(ControlPrevalidacion(
                "coherencia_precios", "WARNING",
                f"Suma de items ({subtotal_items:.2f}) + cargos ({flete+seguro+otros:.2f}) = {total_esperado:.2f} "
                f"difiere del total ({total:.2f}) en {diff_val:.2f} {moneda}.",
            ))

    for i, d in enumerate(detalles):
        precio = _float(d.get("precio_unitario"))
        desc = d.get("descripcion_producto", "")
        if precio <= 0:
            etapa.agregar_control(ControlPrevalidacion(
                f"precio_item_{i}", "WARNING",
                f"Item '{desc}' tiene precio unitario {precio}.",
            ))

    descuentos = doc.get("descuentos") or doc.get("discounts")
    if descuentos:
        if isinstance(descuentos, (int, float)) and descuentos > 0:
            etapa.agregar_control(ControlPrevalidacion(
                "descuentos_documentados", "WARNING",
                f"Descuento detectado ({descuentos} {moneda}). Verificar documentacion de respaldo.",
            ))
        elif isinstance(descuentos, list) and len(descuentos) > 0:
            total_desc = sum(_float(d.get("monto", 0)) for d in descuentos if isinstance(d, dict))
            if total_desc > 0:
                etapa.agregar_control(ControlPrevalidacion(
                    "descuentos_documentados", "WARNING",
                    f"Descuento(s) detectado(s) por {total_desc:.2f} {moneda}. Deben estar documentados.",
                ))

    regalias = doc.get("regalias") or doc.get("royalties")
    if regalias:
        monto_reg = _float(regalias.get("monto", regalias) if isinstance(regalias, dict) else regalias)
        if monto_reg > 0:
            etapa.agregar_control(ControlPrevalidacion(
                "regalias", "WARNING",
                f"Regalias o asistencia tecnica detectada ({monto_reg} {moneda}). Debe agregarse al valor aduanero.",
            ))

    relacion = doc.get("relacion_vinculacion") or doc.get("related_party")
    if relacion:
        if isinstance(relacion, str):
            relacion = relacion.lower() in ("si", "yes", "true", "1")
        if relacion:
            etapa.agregar_control(ControlPrevalidacion(
                "vinculacion", "WARNING",
                "Partes vinculadas detectadas. Verificar que el valor de transaccion refleje el precio realmente pagado.",
            ))

    etapa.calcular_estado()
    exitosos = sum(1 for c in etapa.controles if c.estado == "PASS")
    etapa.resumen = f"{exitosos} de {len(etapa.controles)} controles OK"
    return etapa

def etapa6_validacion_plazos(doc: dict, bl: Optional[dict] = None) -> EtapaPrevalidacion:
    etapa = EtapaPrevalidacion(
        numero=6,
        titulo="Validacion de Plazos y Vigencias",
        descripcion="Verifica que la factura y el BL esten dentro de plazos validos y que los permisos esten vigentes.",
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
                    f"Factura emitida hace {dias} dia(s). Dentro del plazo de 60 dias.",
                ))
            else:
                etapa.agregar_control(ControlPrevalidacion(
                    "vigencia_factura", "FAIL",
                    f"Factura emitida hace {dias} dia(s). Excede el plazo de 60 dias para numeracion.",
                ))
        except ValueError:
            etapa.agregar_control(ControlPrevalidacion(
                "vigencia_factura", "WARNING",
                f"Formato de fecha '{fecha_factura_str}' no reconocido. Verificar manualmente.",
            ))
    else:
        etapa.agregar_control(ControlPrevalidacion(
            "vigencia_factura", "FAIL", "Fecha de emision no disponible. No se puede verificar vigencia."
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
                        f"BL emitido hace {dias_bl} dia(s). Dentro del plazo de 30 dias.",
                    ))
                else:
                    etapa.agregar_control(ControlPrevalidacion(
                        "vigencia_bl", "WARNING",
                        f"BL emitido hace {dias_bl} dia(s). Excede plazo recomendado de 30 dias.",
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
                        "Poliza de seguro vigente (cubre la fecha actual).",
                    ))
                else:
                    etapa.agregar_control(ControlPrevalidacion(
                        "cobertura_seguro", "FAIL",
                        "Poliza de seguro NO vigente. Fecha fuera del periodo de cobertura.",
                    ))
            except ValueError:
                etapa.agregar_control(ControlPrevalidacion(
                    "cobertura_seguro", "WARNING",
                    "Formato de fecha de seguro no reconocido. Verificar manualmente.",
                ))
        elif seguro_poliza.get("numero") or seguro_poliza.get("numero_poliza"):
            etapa.agregar_control(ControlPrevalidacion(
                "cobertura_seguro", "WARNING",
                "Poliza de seguro declarada pero sin fechas de cobertura. Verificar vigencia manualmente.",
            ))
    elif seguro_poliza:
        etapa.agregar_control(ControlPrevalidacion(
            "cobertura_seguro", "WARNING",
            "Seguro declarado pero sin detalle de poliza. Verificar cobertura.",
        ))

    etapa.calcular_estado()
    exitosos = sum(1 for c in etapa.controles if c.estado == "PASS")
    etapa.resumen = f"{exitosos} de {len(etapa.controles)} controles OK"
    return etapa

def etapa7_preclasificacion_riesgo(etapas: list[EtapaPrevalidacion]) -> EtapaPrevalidacion:
    etapa = EtapaPrevalidacion(
        numero=7,
        titulo="Preclasificacion de Riesgo",
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
        elif e.estado == "PENDIENTE":
            punt = 0
        elif e.estado == "WARNING":
            punt = peso * 0.5
        elif e.estado == "FAIL":
            punt = peso
        else:
            punt = peso * 0.2
        puntaje_total += punt
        e.peso = peso
        e.contribucion = round(punt, 1)
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
        nivel = NivelRiesgo.ALTO.value

    etapa.agregar_control(ControlPrevalidacion(
        "scoring_final", "PASS" if nivel == NivelRiesgo.BAJO.value else "WARNING" if nivel == NivelRiesgo.MEDIO.value else "FAIL",
        f"Riesgo: {nivel}. Puntaje: {pct}% (max: {puntaje_maximo}, obtenido: {puntaje_total:.1f}).",
        detalle=str({"puntaje_total": round(puntaje_total, 1), "puntaje_maximo": puntaje_maximo, "porcentaje": pct, "resultados_por_etapa": resultados_por_etapa}),
    ))
    etapa.calcular_estado()
    etapa.resumen = f"Riesgo {nivel} ({pct}%)"
    setattr(etapa, "_nivel_riesgo", nivel)
    setattr(etapa, "_puntaje_riesgo", pct)
    return etapa

class ServicioPrevalidacionAduanera:
    @staticmethod
# Valida que la factura tenga los campos minimos obligatorios
def etapa1_validacion_formal(doc: dict) -> EtapaPrevalidacion:
        return etapa1_validacion_formal(doc)

    @staticmethod
# Valida el calculo aritmetico CIF y la asignacion de partidas arancelarias
def etapa2_validacion_cif(doc: dict) -> EtapaPrevalidacion:
        return etapa2_validacion_cif(doc)

    @staticmethod
# Evalua requisitos regulatorios y permisos faltantes por partida arancelaria
def etapa3_validacion_normativa(doc: dict) -> EtapaPrevalidacion:
        return etapa3_validacion_normativa(doc)

    @staticmethod
# Cruza pesos, bultos y cantidades entre factura, packing list y BL
def etapa4_validacion_pesos(doc: dict, packing_list: Optional[dict] = None, bl: Optional[dict] = None) -> EtapaPrevalidacion:
        return etapa4_validacion_pesos(doc, packing_list, bl)

    @staticmethod
# Verifica consistencia del Incoterm, ajustes al valor aduanero y relacion comprador-vendedor
def etapa5_validacion_valoracion(doc: dict) -> EtapaPrevalidacion:
        return etapa5_validacion_valoracion(doc)

    @staticmethod
# Verifica que la factura, BL y seguro esten dentro de plazos y vigencias
def etapa6_validacion_plazos(doc: dict, bl: Optional[dict] = None) -> EtapaPrevalidacion:
        return etapa6_validacion_plazos(doc, bl)

    @staticmethod
# Calcula el scoring de riesgo consolidando todas las etapas anteriores
def etapa7_preclasificacion_riesgo(etapas: list[EtapaPrevalidacion]) -> EtapaPrevalidacion:
        return etapa7_preclasificacion_riesgo(etapas)

    # Ejecuta las 7 etapas de prevalidacion en orden y retorna el resultado completo
    @classmethod
    def ejecutar(
        cls,
        factura: dict,
        packing_list: Optional[dict] = None,
        bl: Optional[dict] = None,
    ) -> dict:
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
