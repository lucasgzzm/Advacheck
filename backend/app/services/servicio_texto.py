import json
import logging
import os
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException, status

from ..config import GEMINI_API_KEY

logger = logging.getLogger(__name__)


def _cargar_clasificaciones() -> list[dict]:
    ruta = os.path.join(os.path.dirname(__file__), "datos_clasificacion.json")
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def _clasificar_local(descripcion: str) -> Optional[dict]:
    desc_lower = descripcion.lower()
    clasificaciones = _cargar_clasificaciones()

    for entry in clasificaciones:
        if any(palabra in desc_lower for palabra in entry["palabras_clave"]):
            return {
                "partida_sugerida": entry["partida_sugerida"],
                "descripcion_tarifa": entry["descripcion_tarifa"],
                "justificacion": entry["justificacion"],
                "suficiencia_legal": entry["suficiencia_legal"],
                "regla_aplicada": entry["regla_aplicada"],
                "traduccion_tecnica": entry["traduccion_tecnica"],
                "rrna_requerida": entry["rrna_requerida"],
                "rrna_detalles": entry["rrna_detalles"],
            }

    return {
        "partida_sugerida": "8517.18.00.00",
        "descripcion_tarifa": "Otros aparatos emisores con receptor incorporado",
        "justificacion": "Clasificado provisionalmente en el Capítulo 85 por tratarse de manufacturas eléctricas/electrónicas de transmisión de telecomunicaciones. Requiere mayor información técnica sobre potencia y modulación. RGI 1.",
        "suficiencia_legal": "INSUFICIENTE",
        "regla_aplicada": "RGI 2",
        "traduccion_tecnica": "Dispositivos inalámbricos de comunicación digital y transmisión por radiofrecuencia",
        "rrna_requerida": False,
        "rrna_detalles": None,
    }


def _extraer_json_respuesta(texto_respuesta: str) -> dict:
    if "```json" in texto_respuesta:
        texto_respuesta = texto_respuesta.split("```json")[1].split("```")[0].strip()
    elif "```" in texto_respuesta:
        texto_respuesta = texto_respuesta.split("```")[1].split("```")[0].strip()
    return json.loads(texto_respuesta)


async def _llamar_gemini(prompt: str) -> Optional[dict]:
    if not GEMINI_API_KEY:
        return None

    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    headers = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Se alcanzó el límite de peticiones. Espera un momento e intenta de nuevo.",
            )
        logger.error(f"Error HTTP en Gemini ({e.response.status_code}): {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Error en petición a Gemini: {e}")
        return None


class AITextService:
    """Servicio de estructuración de texto usando la API de Google Gemini."""

    @staticmethod
    async def parse_invoice(raw_text: str) -> Optional[Dict[str, Any]]:
        system_prompt = """
Eres un sistema de extracción de datos para documentos de comercio exterior.
Tu objetivo es leer el texto de un documento aduanero y estructurarlo en formato JSON.

Instrucciones de Auditoría Estricta:
1. PRIORIDAD DE DIVISA: Identifica el código de moneda ISO 4217 (ej: USD, EUR, CNY) antes de procesar montos. No asumas USD.
2. JERARQUÍA DE ÍTEMS: Realiza un análisis de diseño (layout) para alinear correctamente cada descripción con su cantidad, valor unitario y valor total.
3. CLASIFICACIÓN: Extrae códigos arancelarios (HS Code) de al menos 6 dígitos. Si no existen, sugiérelos basándote en la descripción técnica.
4. INCOTERMS: Busca términos de la ICC (Incoterms 2020) como FOB, CIF, EXW, DAP, etc.
5. CUMPLIMIENTO CHILE: Si el receptor está en Chile (CL), busca obligatoriamente el RUT o Tax ID.
6. ARITMÉTICA ADUANERA: Valida internamente que la suma de (items) + flete + seguro + otros sea igual al Total de la Factura en la moneda original.

Responde ÚNICAMENTE con un objeto JSON válido usando esta estructura:
{
  "tipo_documento": "COMERCIAL_INVOICE | CUSTOMS_DECLARATION | OTHER",
  "numero_factura": "str",
  "fecha_emision": "str (YYYY-MM-DD)",
  "moneda": "str (ISO 4217)",
  "incoterm": "str (ej: FOB, CIF, DAP)",
  "pais_origen": "str",
  "monto_subtotal": float,
  "monto_total_cif": float,
  "monto_flete": float,
  "monto_seguro": float,
  "monto_otros_gastos": float,
  "pesos": {
    "bruto": float,
    "neto": float,
    "unidad": "str (ej: kg)"
  },
  "emisor": { "nombre": "str", "pais": "str", "direccion": "str", "tax_id": "str" },
  "receptor": { "nombre": "str", "pais": "str", "direccion": "str", "tax_id": "str" },
  "detalles": [
    {
      "descripcion_producto": "str",
      "cantidad": float,
      "precio_unitario": float,
      "valor_total_item": float,
      "partida_arancelaria_sugerida": "str (6+ dígitos)"
    }
  ]
}
"""
        prompt_completo = f"{system_prompt}\n\n=== TEXTO DEL DOCUMENTO ===\n{raw_text}\n=== FIN DEL TEXTO ==="
        resultado = await _llamar_gemini(prompt_completo)

        if not resultado:
            return None

        usage = resultado.get("usageMetadata", {})
        tokens_info = {
            "input": usage.get("promptTokenCount", 0),
            "output": usage.get("candidatesTokenCount", 0),
            "total": usage.get("totalTokenCount", 0),
        }

        json_text = resultado["candidates"][0]["content"]["parts"][0]["text"]
        data_parsed = _extraer_json_respuesta(json_text)

        logger.info(f"Estructuración completada. Tokens: {tokens_info['total']}")
        return {"data": data_parsed, "tokens": tokens_info}

    @staticmethod
    async def classify_item(descripcion_producto: str) -> Optional[Dict[str, Any]]:
        if not GEMINI_API_KEY:
            return _clasificar_local(descripcion_producto)

        system_prompt = """
Eres un clasificador arancelario aduanero experto de la OMA (Organización Mundial de Aduanas) y un traductor técnico bilingüe especializado en comercio exterior.
Tu tarea es recibir la descripción comercial de un producto (que puede venir en inglés, alemán, chino, etc.) y realizar lo siguiente:
1. Clasificación arancelaria más probable (HS Code a 6 u 8 dígitos).
2. Determinar una justificación legal detallada basada en las Reglas Generales de Interpretación (RGI) y las Notas de Sección/Capítulo.
3. Realizar una TRADUCCIÓN TÉCNICA Y FORMAL de la descripción original al español técnico aduanero oficial.
4. Detectar si la naturaleza del producto requiere Regulaciones y Restricciones No Arancelarias (RRNA) como permisos sanitarios (COFEPRIS, FDA, ISP), regulaciones ambientales de sustancias peligrosas o normas técnicas oficiales obligatorias.

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "partida_sugerida": "str (HS Code, ej: 7318.15.99)",
  "descripcion_tarifa": "str (Descripción oficial de la tarifa arancelaria)",
  "justificacion": "str (Explicación técnica detallada y mención de RGI y Notas de Sección)",
  "suficiencia_legal": "SUFICIENTE | INSUFICIENTE",
  "regla_aplicada": "str (ej: RGI 1 y RGI 6)",
  "traduccion_tecnica": "str (Traducción técnica formal al español aduanero de la descripción del producto)",
  "rrna_requerida": boolean,
  "rrna_detalles": "str o null"
}
"""
        prompt_completo = f"{system_prompt}\n\n=== DESCRIPCIÓN DEL PRODUCTO ===\n{descripcion_producto}"
        resultado = await _llamar_gemini(prompt_completo)

        if not resultado:
            return _clasificar_local(descripcion_producto)

        try:
            json_text = resultado["candidates"][0]["content"]["parts"][0]["text"]
            return _extraer_json_respuesta(json_text)
        except (KeyError, json.JSONDecodeError) as e:
            logger.error(f"Error parseando respuesta de Gemini: {e}")
            return _clasificar_local(descripcion_producto)
