import re
from typing import Optional, Tuple
from difflib import SequenceMatcher

def convertir_a_float(valor) -> float:
    """Intenta convertir un valor a float, retorna 0.0 si falla."""
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
    """Convierte un valor a float de forma segura. Retorna None si falla."""
    if valor is None:
        return None
    try:
        return float(valor)
    except (ValueError, TypeError):
        return None

def obtener_valor_anidado(diccionario: dict, *llaves, default=None):
    """Busca un valor en un diccionario anidado probando múltiples llaves posibles en cada nivel o como alias."""
    for llave in llaves:
        if isinstance(diccionario, dict):
            valor = diccionario.get(llave)
            if valor is not None:
                return valor
        # Si la estructura actual no es un dict pero queremos probar si las llaves previas bajaron un nivel, esto es útil.
        # En la implementación original, esto iteraba sobre "alias".
    return default

def comparar_textos(a: str, b: str, umbral: float = 0.75) -> Tuple[bool, float]:
    """Compara dos cadenas con lógica difusa y retorna (coincide, puntaje)."""
    if not a or not b:
        return False, 0.0
    a = a.lower().strip()
    b = b.lower().strip()
    score = SequenceMatcher(None, a, b).ratio()
    return score >= umbral, round(score, 4)

def coincide_patron(valor: str, patron: str) -> bool:
    """Verifica si un string coincide con una expresión regular dada."""
    if not valor:
        return False
    return bool(re.search(patron, valor, re.IGNORECASE))
