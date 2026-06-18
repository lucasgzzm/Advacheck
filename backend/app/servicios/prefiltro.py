import re
from typing import Any

KEYWORDS_COMERCIO_EXTERIOR = re.compile(
    r"INVOICE|FACTURA|BILL OF LADING|PACKING LIST|CIF|FOB|INCOTERM|"
    r"CANTIDAD|PRECIO|FOB VALUE|GROSS WEIGHT|SHIPPER|CONSIGNEE|"
    r"RUT|TOTAL.*CIF|CONOCIMIENTO.*EMBARQUE|LISTA.*EMPAQUE|"
    r"NOTE|PACKAGE|WEIGHT|NET|BRUT|SHIPPED|PORT|ORIGIN|DESTINY",
    re.IGNORECASE,
)

KEYWORDS_TYC = re.compile(
    r"TERMS AND CONDITIONS|TÉRMINOS Y CONDICIONES|PRIVACY POLICY|"
    r"AVISO LEGAL|CONDITIONS OF SALE|LIMITATION OF LIABILITY|"
    r"TERMINOS.*CONDICIONES|TERMS.*SALE|COPYRIGHT|"
    r"ALL RIGHTS RESERVED|TODOS LOS DERECHOS",
    re.IGNORECASE,
)

PATRON_DATOS_NUMERICOS = re.compile(r"\d+.*\d+.*\d+")


def _clasificar_pagina(texto: str) -> str:
    lineas = texto.strip().split("\n")
    if len(texto.strip()) < 50:
        return "VACIA"

    if KEYWORDS_TYC.search(texto):
        lineas_repetitivas = sum(
            1 for l in lineas if len(l.strip()) > 10
        )
        if lineas_repetitivas > 0 and (lineas_repetitivas / max(len(lineas), 1)) > 0.6:
            return "TYC"

    tiene_keywords = bool(KEYWORDS_COMERCIO_EXTERIOR.search(texto))
    lineas_numericas = sum(1 for l in lineas if PATRON_DATOS_NUMERICOS.search(l))

    if tiene_keywords and lineas_numericas >= 2:
        return "RELEVANTE"
    if tiene_keywords:
        return "RELEVANTE"
    if lineas_numericas >= 3:
        return "RELEVANTE"

    return "IRRELEVANTE"


def filtrar_paginas_relevantes(pages: list[dict]) -> dict[str, Any]:
    chars_originales = sum(len(p["text"]) for p in pages)
    paginas_originales = len(pages)

    filtradas = []
    paginas_excluidas = []
    for p in pages:
        clase = _clasificar_pagina(p["text"])
        if clase == "RELEVANTE":
            filtradas.append(p)
        else:
            paginas_excluidas.append({"page_num": p["page_num"], "clase": clase})

    if not filtradas:
        filtradas = pages

    chars_enviados = sum(len(p["text"]) for p in filtradas)
    paginas_enviadas = len(filtradas)
    reduccion_pct = round((1 - chars_enviados / max(chars_originales, 1)) * 100, 1)

    return {
        "pages": filtradas,
        "metrics": {
            "chars_originales": chars_originales,
            "chars_enviados": chars_enviados,
            "paginas_originales": paginas_originales,
            "paginas_enviadas": paginas_enviadas,
            "reduccion_pct": reduccion_pct,
            "paginas_excluidas": paginas_excluidas,
        },
    }
