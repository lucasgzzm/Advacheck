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


def verificar_cuadre_cif(
    subtotal: float,
    flete: float,
    seguro: float,
    otros: float,
    total_declarado: float,
    tolerancia: float = 2.0,
) -> Tuple[bool, float, str]:
    """
    Verifica que subtotal + flete + seguro + otros cuadre con el total CIF declarado.

    Args:
        subtotal: Suma de los items (FOB).
        flete: Monto del flete.
        seguro: Monto del seguro.
        otros: Otros gastos.
        total_declarado: Total CIF declarado en el documento.
        tolerancia: Margen permitido para redondeos (default 2.0).

    Returns:
        Tuple[bool, float, str]: (cuadra, diferencia, mensaje descriptivo).
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
