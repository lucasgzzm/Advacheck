
ENTIDADES_POR_PARTIDA = [
    # SEREMI de Salud — Certificado de Destinación Aduanera (CDA) / Uso y Disposición
    # Alimentos procesados, pastas, salsas, bebidas, aceites comestibles, conservas
    {"rango_desde": "1501", "rango_hasta": "1518", "entidad": "SEREMI de Salud", "tipo": "CDA / Uso y Disposicion de Alimentos"},
    {"rango_desde": "1601", "rango_hasta": "1605", "entidad": "SEREMI de Salud", "tipo": "CDA / Uso y Disposicion de Alimentos"},
    {"rango_desde": "1701", "rango_hasta": "1704", "entidad": "SEREMI de Salud", "tipo": "CDA / Uso y Disposicion de Alimentos"},
    {"rango_desde": "1801", "rango_hasta": "1806", "entidad": "SEREMI de Salud", "tipo": "CDA / Uso y Disposicion de Alimentos"},
    {"rango_desde": "1901", "rango_hasta": "1905", "entidad": "SEREMI de Salud", "tipo": "CDA / Uso y Disposicion de Alimentos"},
    {"rango_desde": "2001", "rango_hasta": "2009", "entidad": "SEREMI de Salud", "tipo": "CDA / Uso y Disposicion de Alimentos"},
    {"rango_desde": "2101", "rango_hasta": "2106", "entidad": "SEREMI de Salud", "tipo": "CDA / Uso y Disposicion de Alimentos"},
    {"rango_desde": "2201", "rango_hasta": "2209", "entidad": "SEREMI de Salud", "tipo": "CDA / Uso y Disposicion de Bebidas"},
    {"rango_desde": "2301", "rango_hasta": "2309", "entidad": "SEREMI de Salud", "tipo": "CDA / Uso y Disposicion de Alimentos"},

    # SAG — Certificado Zoosanitario / Fitosanitario / Internación de Maderas
    # Carnes, frutas frescas, semillas, productos agrícolas sin procesar, maderas
    {"rango_desde": "0101", "rango_hasta": "0110", "entidad": "SAG", "tipo": "Certificado Zoosanitario de Importacion"},
    {"rango_desde": "0201", "rango_hasta": "0210", "entidad": "SAG", "tipo": "Certificado Zoosanitario de Importacion"},
    {"rango_desde": "0301", "rango_hasta": "0308", "entidad": "SAG", "tipo": "Certificado Zoosanitario de Importacion"},
    {"rango_desde": "0401", "rango_hasta": "0410", "entidad": "SAG", "tipo": "Certificado Zoosanitario de Importacion"},
    {"rango_desde": "0501", "rango_hasta": "0511", "entidad": "SAG", "tipo": "Certificado Zoosanitario de Importacion"},
    {"rango_desde": "0601", "rango_hasta": "0604", "entidad": "SAG", "tipo": "Certificado Fitosanitario de Importacion"},
    {"rango_desde": "0701", "rango_hasta": "0714", "entidad": "SAG", "tipo": "Certificado Fitosanitario de Importacion"},
    {"rango_desde": "0801", "rango_hasta": "0814", "entidad": "SAG", "tipo": "Certificado Fitosanitario de Importacion"},
    {"rango_desde": "0901", "rango_hasta": "0910", "entidad": "SAG", "tipo": "Certificado Fitosanitario de Importacion"},
    {"rango_desde": "1001", "rango_hasta": "1008", "entidad": "SAG", "tipo": "Certificado Fitosanitario de Importacion"},
    {"rango_desde": "1101", "rango_hasta": "1109", "entidad": "SAG", "tipo": "Certificado Fitosanitario de Importacion"},
    {"rango_desde": "1201", "rango_hasta": "1214", "entidad": "SAG", "tipo": "Certificado Fitosanitario de Importacion"},
    {"rango_desde": "1301", "rango_hasta": "1302", "entidad": "SAG", "tipo": "Certificado Fitosanitario de Importacion"},
    {"rango_desde": "1401", "rango_hasta": "1404", "entidad": "SAG", "tipo": "Certificado Fitosanitario de Importacion"},
    {"rango_desde": "4401", "rango_hasta": "4421", "entidad": "SAG", "tipo": "Certificado de Internacion de Maderas"},

    # SUBTEL — Homologación / Permiso de Internación
    # Dispositivos con conectividad celular, Wi-Fi, Bluetooth, radiofrecuencia
    {"rango_desde": "8517", "rango_hasta": "8517", "entidad": "SUBTEL", "tipo": "Homologacion / Permiso de Internacion"},
    {"rango_desde": "8525", "rango_hasta": "8526", "entidad": "SUBTEL", "tipo": "Homologacion / Permiso de Internacion"},
    {"rango_desde": "8527", "rango_hasta": "8527", "entidad": "SUBTEL", "tipo": "Homologacion / Permiso de Internacion"},

    # SEC — Certificación de Seguridad Eléctrica
    # Electrodomésticos, ampolletas, cables, cargadores, transformadores
    {"rango_desde": "8504", "rango_hasta": "8504", "entidad": "SEC", "tipo": "Certificacion de Seguridad Electrica"},
    {"rango_desde": "8516", "rango_hasta": "8516", "entidad": "SEC", "tipo": "Certificacion de Seguridad Electrica"},
    {"rango_desde": "8539", "rango_hasta": "8539", "entidad": "SEC", "tipo": "Certificacion de Seguridad Electrica"},
    {"rango_desde": "8541", "rango_hasta": "8541", "entidad": "SEC", "tipo": "Certificacion de Seguridad Electrica"},
    {"rango_desde": "8544", "rango_hasta": "8544", "entidad": "SEC", "tipo": "Certificacion de Seguridad Electrica"},

    # ISP — Registro Sanitario / Certificado de Destinación
    # Cosméticos, perfumes, medicamentos, dispositivos médicos
    {"rango_desde": "3001", "rango_hasta": "3006", "entidad": "ISP", "tipo": "Registro Sanitario / Certificado de Destinacion"},
    {"rango_desde": "3303", "rango_hasta": "3307", "entidad": "ISP", "tipo": "Registro Sanitario / Certificado de Destinacion"},
    {"rango_desde": "9018", "rango_hasta": "9022", "entidad": "ISP", "tipo": "Registro Sanitario / Certificado de Destinacion"},
]

INCOTERMS_VALIDOS = {"FOB", "CIF", "EXW", "FCA", "FAS", "CFR", "CPT", "CIP", "DAP", "DPU", "DDP"}
INCOTERMS_MARITIMOS = {"FAS", "FOB", "CFR", "CIF"}
INCOTERMS_SEGURO_OBLIGA = {"CIF", "CIP"}
MONEDAS_VALIDAS = {"USD", "EUR", "CLP", "MXN", "PEN", "COP", "BRL", "ARS"}

REGULADORES = {
    "SEREMI de Salud": "Secretaria Regional Ministerial de Salud — Autoridad Sanitaria",
    "SAG": "Servicio Agricola y Ganadero",
    "SUBTEL": "Subsecretaria de Telecomunicaciones",
    "SEC": "Superintendencia de Electricidad y Combustibles",
    "ISP": "Instituto de Salud Publica",
}

# Normaliza el codigo de partida arancelaria a 4 digitos
def normalizar_partida(partida: str) -> str:
    if not partida:
        return ""
    partida_limpia = partida.replace(".", "").replace(" ", "").replace("-", "")
    return partida_limpia[:4].ljust(4, "0")

# Identifica las entidades regulatorias aplicables segun la partida
def detectar_entidades_para_partida(partida: str) -> list:
    if not partida:
        return []
    codigo = normalizar_partida(partida)
    resultados = []
    for regla in ENTIDADES_POR_PARTIDA:
        if regla["rango_desde"] <= codigo <= regla["rango_hasta"]:
            resultados.append({
                "entidad": regla["entidad"],
                "tipo_permiso": regla["tipo"],
                "estado": "pendiente",
            })
    return resultados
