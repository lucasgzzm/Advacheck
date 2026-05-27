"""
Módulo centralizado para datos regulatorios, catálogos estáticos y funciones de normalización.
Elimina la duplicación de catálogos en el sistema.
"""

# ──────────────────────────────────────────────
#  Catálogo de Entidades y Permisos
# ──────────────────────────────────────────────

ENTIDADES_POR_PARTIDA = [
    {"rango_desde": "0101", "rango_hasta": "0609", "entidad": "SENASA", "tipo": "Certificado Fitosanitario", "ley": "Ley N° 18.450 / Resolución SENASA N° 125"},
    {"rango_desde": "0201", "rango_hasta": "0210", "entidad": "SAG", "tipo": "Certificado Zoosanitario", "ley": "Reglamento General de Cárnicos"},
    {"rango_desde": "0301", "rango_hasta": "0308", "entidad": "SERNAPESCA", "tipo": "Certificado Sanitario de Pesca", "ley": "Ley General de Pesca y Acuicultura"},
    {"rango_desde": "0401", "rango_hasta": "0410", "entidad": "SAG", "tipo": "Certificado Sanitario Lácteos", "ley": "Norma Técnica N° 145"},
    {"rango_desde": "1001", "rango_hasta": "1006", "entidad": "SENASA", "tipo": "Certificado Fitosanitario de Granos", "ley": "Resolución SENASA N° 78"},
    {"rango_desde": "1501", "rango_hasta": "1518", "entidad": "SENASA", "tipo": "Certificado Sanitario de Aceites", "ley": "Código Alimentario"},
    {"rango_desde": "1601", "rango_hasta": "1605", "entidad": "ISP", "tipo": "Registro Sanitario de Alimentos", "ley": "Reglamento Sanitario de Alimentos"},
    {"rango_desde": "2001", "rango_hasta": "2009", "entidad": "ISP", "tipo": "Registro Sanitario de Alimentos", "ley": "Resolución ISP N° 788"},
    {"rango_desde": "2101", "rango_hasta": "2106", "entidad": "ISP", "tipo": "Registro Sanitario de Alimentos", "ley": "Reglamento Sanitario de Alimentos"},
    {"rango_desde": "2201", "rango_hasta": "2209", "entidad": "ISP", "tipo": "Registro Sanitario de Bebidas", "ley": "Ley N° 19.925"},
    {"rango_desde": "2401", "rango_hasta": "2403", "entidad": "ISP", "tipo": "Registro Sanitario de Tabaco", "ley": "Ley N° 20.660"},
    {"rango_desde": "2710", "rango_hasta": "2715", "entidad": "SEC", "tipo": "Certificado de Calidad de Combustibles", "ley": "DS N° 160 / Reglamento SEC"},
    {"rango_desde": "2801", "rango_hasta": "2853", "entidad": "COFEPRIS", "tipo": "Permiso de Sustancias Químicas Controladas", "ley": "NOM-005-SSA1"},
    {"rango_desde": "2901", "rango_hasta": "2942", "entidad": "COFEPRIS", "tipo": "Permiso de Sustancias Químicas Esenciales", "ley": "Ley Federal de Químicos Esenciales"},
    {"rango_desde": "3001", "rango_hasta": "3006", "entidad": "ISP", "tipo": "Registro Sanitario de Medicamentos", "ley": "DS N° 3 / ISP Reglamento Farmacéutico"},
    {"rango_desde": "3001", "rango_hasta": "3006", "entidad": "COFEPRIS", "tipo": "Registro Sanitario de Medicamentos", "ley": "NOM-059-SSA1"},
    {"rango_desde": "3808", "rango_hasta": "3809", "entidad": "SAG", "tipo": "Certificado de Plaguicidas", "ley": "Resolución SAG N° 2.348"},
    {"rango_desde": "4011", "rango_hasta": "4013", "entidad": "INN", "tipo": "Certificado de Norma Técnica de Neumáticos", "ley": "NCH 2369"},
    {"rango_desde": "6403", "rango_hasta": "6405", "entidad": "SEC", "tipo": "Certificado de Seguridad de Calzado", "ley": "NCH 1970"},
    {"rango_desde": "8418", "rango_hasta": "8418", "entidad": "SEC", "tipo": "Certificado de Eficiencia Energética", "ley": "DS N° 298 / Reglamento SEC"},
    {"rango_desde": "8471", "rango_hasta": "8473", "entidad": "SUBTEL", "tipo": "Homologación de Equipos de Telecomunicaciones", "ley": "Ley N° 18.168 / Norma Técnica SUBTEL"},
    {"rango_desde": "8517", "rango_hasta": "8518", "entidad": "SUBTEL", "tipo": "Homologación de Equipos de Telecomunicaciones", "ley": "Resolución SUBTEL N° 600"},
    {"rango_desde": "8525", "rango_hasta": "8528", "entidad": "SUBTEL", "tipo": "Homologación de Equipos de Radiodifusión", "ley": "Norma Técnica SUBTEL"},
    {"rango_desde": "8542", "rango_hasta": "8542", "entidad": "SEC", "tipo": "Certificado de Seguridad Eléctrica", "ley": "DS N° 298 / NCH 4"},
    {"rango_desde": "8703", "rango_hasta": "8705", "entidad": "MINTRANS", "tipo": "Certificado de Homologación Vehicular", "ley": "DS N° 55 / Ley de Tránsito"},
    {"rango_desde": "9018", "rango_hasta": "9022", "entidad": "ISP", "tipo": "Registro Sanitario de Equipos Médicos", "ley": "DS N° 3 / ISP Reglamento de Dispositivos Médicos"},
    {"rango_desde": "9018", "rango_hasta": "9022", "entidad": "COFEPRIS", "tipo": "Registro Sanitario de Dispositivos Médicos", "ley": "NOM-240-SSA1"},
    {"rango_desde": "9401", "rango_hasta": "9403", "entidad": "SEC", "tipo": "Certificado de Seguridad de Muebles", "ley": "NCH 825"},
    {"rango_desde": "9503", "rango_hasta": "9503", "entidad": "ISP", "tipo": "Certificado de Seguridad de Juguetes", "ley": "NCH 325 / ISP Resolución N° 1.200"},
    {"rango_desde": "9503", "rango_hasta": "9503", "entidad": "SEC", "tipo": "Certificado de Seguridad Eléctrica de Juguetes", "ley": "NCH 4"},
    {"rango_desde": "9506", "rango_hasta": "9506", "entidad": "ISP", "tipo": "Certificado de Seguridad de Artículos Deportivos", "ley": "Resolución ISP N° 450"},
]

REGULADORES = {
    "SENASA": "Servicio Nacional de Sanidad Agraria",
    "SAG": "Servicio Agrícola y Ganadero",
    "SERNAPESCA": "Servicio Nacional de Pesca y Acuicultura",
    "ISP": "Instituto de Salud Pública",
    "COFEPRIS": "Comisión Federal para la Protección contra Riesgos Sanitarios",
    "SEC": "Superintendencia de Electricidad y Combustibles",
    "SUBTEL": "Subsecretaría de Telecomunicaciones",
    "MINTRANS": "Ministerio de Transportes y Telecomunicaciones",
    "INN": "Instituto Nacional de Normalización",
}

# ──────────────────────────────────────────────
#  Catálogos de Incoterms y Monedas
# ──────────────────────────────────────────────

INCOTERMS_VALIDOS = {"FOB", "CIF", "EXW", "FCA", "FAS", "CFR", "CPT", "CIP", "DAP", "DPU", "DDP"}
INCOTERMS_MARITIMOS = {"FAS", "FOB", "CFR", "CIF"}
INCOTERMS_SEGURO_OBLIGA = {"CIF", "CIP"}
MONEDAS_VALIDAS = {"USD", "EUR", "CLP", "MXN", "PEN", "COP", "BRL", "ARS"}

# ──────────────────────────────────────────────
#  Funciones Compartidas
# ──────────────────────────────────────────────

def normalizar_partida(partida: str) -> str:
    """Normaliza un código de partida arancelaria."""
    if not partida:
        return ""
    partida_limpia = partida.replace(".", "").replace(" ", "").replace("-", "")
    return partida_limpia[:4].ljust(4, "0")

def detectar_entidades_para_partida(partida: str) -> list:
    """Detecta las entidades que aplican a una partida según el catálogo."""
    if not partida:
        return []
    codigo = normalizar_partida(partida)
    resultados = []
    for regla in ENTIDADES_POR_PARTIDA:
        if regla["rango_desde"] <= codigo <= regla["rango_hasta"]:
            resultados.append({
                "entidad": regla["entidad"],
                "tipo_permiso": regla["tipo"],
                "ley": regla.get("ley", ""),
                "estado": "pendiente",
            })
    return resultados
