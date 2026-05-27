from xml.dom import minidom
from xml.etree.ElementTree import Element, SubElement, tostring
from typing import Optional
from datetime import datetime


def _xml_pretty(root: Element) -> str:
    """Formatea un ElementTree como XML indentado."""
    raw = tostring(root, encoding="unicode")
    dom = minidom.parseString(raw.encode("utf-8"))
    return dom.toprettyxml(indent="  ")


def _seg(tag: str, text: str = "", parent: Optional[Element] = None) -> Element:
    """Crea un subelemento XML opcionalmente anidado."""
    el = Element(tag)
    el.text = text
    if parent is not None:
        parent.append(el)
    return el


def generar_xml_intercambio(documento: dict, detalles: list[dict], vistos_buenos: list[dict], usuario_nombre: str) -> str:
    """Genera XML de intercambio aduanero con cabecera, operación, ítems y V°B°."""
    now = datetime.utcnow().isoformat()

    root = Element("IntercambioAduanero")
    root.set("xmlns", "http://webcheck.ai/intercambio/v1")
    root.set("version", "1.0")

    cabecera = SubElement(root, "Cabecera")
    _seg("IdDocumento", str(documento.get("id", "")), cabecera)
    _seg("NombreArchivo", documento.get("nombre_archivo", ""), cabecera)
    _seg("FechaGeneracion", now, cabecera)
    _seg("UsuarioGenerador", usuario_nombre, cabecera)
    _seg("EstadoDocumento", documento.get("estado", ""), cabecera)

    operacion = SubElement(root, "Operacion")
    _seg("Proveedor", documento.get("proveedor", ""), operacion)
    _seg("Cliente", documento.get("cliente", ""), operacion)
    _seg("TotalCIF", str(documento.get("total_cif", 0)), operacion)
    _seg("Riesgo", documento.get("riesgo", ""), operacion)
    _seg("Moneda", "USD", operacion)

    if detalles:
        items_el = SubElement(root, "Items")
        for idx, d in enumerate(detalles, 1):
            item_el = SubElement(items_el, "Item")
            _seg("NumeroLinea", str(idx), item_el)
            _seg("Descripcion", d.get("descripcion", ""), item_el)
            _seg("Cantidad", str(d.get("cantidad", 0)), item_el)
            _seg("PrecioUnitario", str(d.get("precio_unitario", 0)), item_el)
            _seg("PartidaArancelaria", d.get("partida_corregida") or d.get("partida_sugerida", ""), item_el)

    if vistos_buenos:
        vbb_el = SubElement(root, "VistosBuenos")
        for vb in vistos_buenos:
            vb_item = SubElement(vbb_el, "VistoBueno")
            _seg("Entidad", vb.get("entidad", ""), vb_item)
            _seg("TipoPermiso", vb.get("tipo_permiso", ""), vb_item)
            _seg("Estado", vb.get("estado", ""), vb_item)
            _seg("Observaciones", vb.get("observaciones", ""), vb_item)

    _seg("FechaAnalisis", documento.get("fecha_analisis", ""), root)

    return _xml_pretty(root)


def generar_json_intercambio(documento: dict, detalles: list[dict], vistos_buenos: list[dict], usuario_nombre: str) -> dict:
    """Genera JSON de intercambio aduanero con cabecera, operación, ítems y V°B°."""
    return {
        "intercambio_aduanero": {
            "version": "1.0",
            "generado_por": "WebCheck - Prevalidacion Aduanera",
            "cabecera": {
                "id_documento": documento.get("id"),
                "nombre_archivo": documento.get("nombre_archivo"),
                "fecha_generacion": datetime.utcnow().isoformat(),
                "usuario_generador": usuario_nombre,
                "estado_documento": documento.get("estado"),
            },
            "operacion": {
                "proveedor": documento.get("proveedor"),
                "cliente": documento.get("cliente"),
                "total_cif": documento.get("total_cif"),
                "riesgo": documento.get("riesgo"),
                "moneda": "USD",
            },
            "items": [
                {
                    "numero_linea": idx + 1,
                    "descripcion": d.get("descripcion"),
                    "cantidad": d.get("cantidad"),
                    "precio_unitario": d.get("precio_unitario"),
                    "partida_arancelaria": d.get("partida_corregida") or d.get("partida_sugerida", ""),
                }
                for idx, d in enumerate(detalles)
            ] if detalles else [],
            "vistos_buenos": [
                {
                    "entidad": vb.get("entidad"),
                    "tipo_permiso": vb.get("tipo_permiso"),
                    "estado": vb.get("estado"),
                    "observaciones": vb.get("observaciones"),
                }
                for vb in (vistos_buenos or [])
            ],
            "fecha_analisis": documento.get("fecha_analisis"),
        }
    }
