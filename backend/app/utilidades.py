import re
from typing import Optional, Tuple
from difflib import SequenceMatcher

def convertir_a_float(valor) -> float:
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
    if valor is None:
        return None
    try:
        return float(valor)
    except (ValueError, TypeError):
        return None

def obtener_valor_anidado(diccionario: dict, *llaves, default=None):
    for llave in llaves:
        if isinstance(diccionario, dict):
            valor = diccionario.get(llave)
            if valor is not None:
                return valor
    return default

def comparar_textos(a: str, b: str, umbral: float = 0.75) -> Tuple[bool, float]:
    if not a or not b:
        return False, 0.0
    a = a.lower().strip()
    b = b.lower().strip()
    score = SequenceMatcher(None, a, b).ratio()
    return score >= umbral, round(score, 4)

def coincide_patron(valor: str, patron: str) -> bool:
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
    calculado = subtotal + flete + seguro + otros
    diff = abs(calculado - total_declarado)

    if total_declarado > 0 and diff <= tolerancia:
        return True, diff, (
            f"CIF cuadrado correcto. {calculado:.2f} ≈ {total_declarado:.2f} "
            f"(subtotal={subtotal}, flete={flete}, seguro={seguro}, otros={otros}, diff={diff:.2f})"
        )

    if total_declarado <= 0:
        return False, diff, (
            "El monto total o el valor CIF es cero o no esta disponible."
        )

    return False, diff, (
        f"Descuadre: Subtotal({subtotal}) + Flete({flete}) + Seguro({seguro}) + Otros({otros}) "
        f"= {calculado:.2f} vs Total({total_declarado:.2f}). Diferencia: {diff:.2f} (tolerancia: {tolerancia})."
    )
