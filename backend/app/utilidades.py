import re
from typing import Optional, Tuple
from difflib import SequenceMatcher


def convertir_a_float(valor) -> float:
    """Intenta convertir un valor a numero, sin importar si viene con $, USD o comas.
    Si no puede convertirlo, devuelve 0.0 para no romper el flujo.
    """
    if valor is None:
        return 0.0
    try:
        if isinstance(valor, str):
            v_str = valor.replace("$", "").replace("USD", "").replace(",", "").strip()
            return float(v_str)
        return float(valor)
    except (ValueError, TypeError):
        return 0.0


def normalizar_numero(valor) -> Optional[float]:
    """Como convertir_a_float pero mas estricto: si falla devuelve None en vez de 0.0.
    Sirve para cuando queremos saber si el valor realmente existia.
    """
    if valor is None:
        return None
    try:
        return float(valor)
    except (ValueError, TypeError):
        return None


def obtener_valor_anidado(diccionario: dict, *llaves, default=None):
    """Busca un valor dentro de un diccionario probando varias llaves posibles.
    Util cuando los datos vienen con nombres distintos segun el documento.
    """
    for llave in llaves:
        if isinstance(diccionario, dict):
            valor = diccionario.get(llave)
            if valor is not None:
                return valor
    return default


def comparar_textos(a: str, b: str, umbral: float = 0.75) -> Tuple[bool, float]:
    """Compara dos textos usando fuzzy matching (SequenceMatcher).
    Devuelve si coinciden segun el umbral y el puntaje de similitud.
    Sirve para cotejar datos extraidos contra valores esperados.
    """
    if not a or not b:
        return False, 0.0
    a = a.lower().strip()
    b = b.lower().strip()
    score = SequenceMatcher(None, a, b).ratio()
    return score >= umbral, round(score, 4)


def coincide_patron(valor: str, patron: str) -> bool:
    """Verifica si un texto matchea con una expresion regular.
    Se usa para validar formatos como RUT, numeros de factura, etc.
    """
    if not valor:
        return False
    return bool(re.search(patron, valor, re.IGNORECASE))


def verificar_cuadre_cif(
    subtotal: float,
    flete: float,
    seguro: float,
    otros: float,
    total_declarado: float,
    tolerancia: float = 2.0,
) -> Tuple[bool, float, str]:
    """Verifica que la suma de subtotal + flete + seguro + otros cuadre con el total CIF.
    
    Es una validacion financiera clave: si los montos no cuadran, algo raro pasa
    con los datos extraidos del PDF.
    
    Returns:
        (cuadra, diferencia, mensaje) - mensaje explica que paso.
    """
    calculado = subtotal + flete + seguro + otros
    diff = abs(calculado - total_declarado)

    if total_declarado > 0 and diff <= tolerancia:
        return True, diff, (
            f"CIF cuadrado correcto. {calculado:.2f} ≈ {total_declarado:.2f} "
            f"(subtotal={subtotal}, flete={flete}, seguro={seguro}, otros={otros}, diff={diff:.2f})"
        )

    if total_declarado <= 0:
        return False, diff, (
            f"Total CIF es cero o no disponible ({total_declarado}). "
            f"No se puede verificar cuadre."
        )

    return False, diff, (
        f"Descuadre: Subtotal({subtotal}) + Flete({flete}) + Seguro({seguro}) + Otros({otros}) "
        f"= {calculado:.2f} vs Total({total_declarado:.2f}). Diferencia: {diff:.2f} (tolerancia: {tolerancia})."
    )
