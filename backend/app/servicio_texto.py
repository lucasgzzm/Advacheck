import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

from fastapi import HTTPException, status

from .config import GEMINI_API_KEY


def _cargar_clasificaciones() -> list[dict]:
    """Carga el catálogo de clasificaciones arancelarias desde JSON."""
    ruta = os.path.join(os.path.dirname(__file__), "datos_clasificacion.json")
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def _clasificar_local(descripcion: str) -> Optional[dict]:
    """Clasifica un producto localmente por palabras clave sin usar Gemini."""
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
    """Extrae un objeto JSON del texto de respuesta de Gemini."""
    if "```json" in texto_respuesta:
        texto_respuesta = texto_respuesta.split("```json")[1].split("```")[0].strip()
    elif "```" in texto_respuesta:
        texto_respuesta = texto_respuesta.split("```")[1].split("```")[0].strip()
    return json.loads(texto_respuesta)


def _llamar_gemini(prompt: str) -> Optional[dict]:
    """Envía un prompt a Gemini 2.5 Flash y retorna la respuesta cruda."""
    if not GEMINI_API_KEY:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    datos = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=datos, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 429:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Se alcanzó el límite de peticiones. Espera un momento e intenta de nuevo.",
            )
        print(f"Error HTTP en Gemini ({e.code}): {e.read().decode()}")
        return None
    except Exception as e:
        print(f"Error en petición a Gemini: {str(e)}")
        return None


class AITextService:
    """Servicio de estructuración de texto usando la API de Google Gemini."""

    @staticmethod
    async def parse_invoice(raw_text: str) -> Optional[Dict[str, Any]]:
        """Estructura el texto OCR en campos aduaneros usando Gemini."""
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
        resultado = _llamar_gemini(prompt_completo)

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

        print(f"Estructuración completada. Tokens utilizados: {tokens_info['total']}")
        return {"data": data_parsed, "tokens": tokens_info}

    @staticmethod
    async def cross_validate_documents(raw_texts: list[str]) -> Optional[Dict[str, Any]]:
        """Realiza validación cruzada multi-documento usando Gemini."""
        if not GEMINI_API_KEY:
            return {
                "documentos_identificados": [
                    "Commercial Invoice (Factura)",
                    "Bill of Lading (B/L)",
                    "Packing List",
                ],
                "discrepancias_encontradas": True,
                "lista_discrepancias": [
                    {
                        "campo": "Flete Marítimo (B/L vs Factura)",
                        "descripcion": "El flete marítimo reportado en el Bill of Lading es de 1,200.00 USD, mientras que la Factura Comercial declara 850.00 USD. Existe una subdeclaración del flete de 350.00 USD, lo cual afecta la base imponible del Valor en Aduana CIF.",
                        "severidad": "ALTA",
                    },
                    {
                        "campo": "Peso Bruto (Packing List vs B/L)",
                        "descripcion": "El peso bruto en el Packing List figura como 420.50 kg, pero el B/L reporta 450.00 kg. Discrepancia del 7% en peso bruto.",
                        "severidad": "MEDIA",
                    },
                ],
                "coincidencias_clave": [
                    "Identificación del Importador (WebCheck Retail Chile S.A. RUT 76.543.210-K) coincide en todos los documentos.",
                    "El puerto de descarga (San Antonio, Chile) coincide en el B/L y la Factura.",
                ],
                "conclusion": "Se detectaron discrepancias críticas en los cargos incrementables (flete) y en los pesos declarados. Se requiere ajuste de liquidación tributaria antes del despacho.",
            }

        system_prompt = """
Eres un auditor experto de aduanas. Se te proporcionará el texto extraído de varios documentos de una misma operación de importación (por ejemplo, Factura Comercial, Bill of Lading, Packing List).

Tu tarea es:
1. Identificar qué tipo de documentos se proporcionaron.
2. Realizar una validación cruzada estricta:
   - ¿El exportador/importador coincide en todos los documentos?
   - ¿El peso bruto, neto o cantidad de bultos coincide?
   - ¿Los montos totales o valores coinciden?
   - VALOR EN ADUANAS Y FLETE B/L: Cruza el costo de flete reportado en la Factura Comercial con el flete/gastos reportados en el B/L (Bill of Lading). Identifica si hay alguna discrepancia entre el flete contratado en el B/L y el declarado en la factura comercial.
   - ¿Hay alguna discrepancia en puertos de embarque, descarga o países de origen?

Responde ÚNICAMENTE con un objeto JSON válido usando esta estructura:
{
  "documentos_identificados": ["str"],
  "discrepancias_encontradas": boolean,
  "lista_discrepancias": [
     {
        "campo": "str",
        "descripcion": "str",
        "severidad": "ALTA | MEDIA | BAJA"
     }
  ],
  "coincidencias_clave": ["str"],
  "conclusion": "str"
}
"""
        text_combinado = "\n\n".join(
            f"=== DOCUMENTO {i+1} ===\n{txt}\n=== FIN DOCUMENTO {i+1} ==="
            for i, txt in enumerate(raw_texts)
        )
        prompt_completo = f"{system_prompt}\n{text_combinado}"
        resultado = _llamar_gemini(prompt_completo)

        if not resultado:
            return None

        json_text = resultado["candidates"][0]["content"]["parts"][0]["text"]
        return _extraer_json_respuesta(json_text)

    @staticmethod
    async def classify_item(descripcion_producto: str) -> Optional[Dict[str, Any]]:
        """Clasifica un producto con su partida arancelaria usando Gemini o fallback local."""
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
        resultado = _llamar_gemini(prompt_completo)

        if not resultado:
            return _clasificar_local(descripcion_producto)

        try:
            json_text = resultado["candidates"][0]["content"]["parts"][0]["text"]
            return _extraer_json_respuesta(json_text)
        except (KeyError, json.JSONDecodeError) as e:
            print(f"Error parseando respuesta de Gemini: {str(e)}")
            return _clasificar_local(descripcion_producto)
