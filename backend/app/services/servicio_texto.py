import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException, status

from ..configuracion import GEMINI_API_KEY, GEMINI_MAX_RPM, GEMINI_MIN_INTERVAL

logger = logging.getLogger(__name__)


class RateLimiterIA:
    """Limitador de velocidad para APIs de inteligencia artificial.
    Usa una ventana deslizante de 60 segundos para garantizar que no se supere
    el maximo de requests por minuto configurado. Todos los agentes comparten
    la misma instancia, por lo que las esperas se acumulan entre ellos.
    """

    def __init__(self, max_por_minuto: int, intervalo_minimo: float):
        """Inicializa el limitador.
        - max_por_minuto: maximo de requests permitidas en una ventana de 60s
        - intervalo_minimo: segundos minimos entre request y request
        """
        self._max_por_minuto = max_por_minuto
        self._intervalo_minimo = intervalo_minimo
        self._timestamps: list[float] = []
        self._lock = asyncio.Lock()

    async def adquirir(self) -> float:
        """Espera el tiempo necesario para no superar los limites y registra la request.
        Retorna cuantos segundos se espero realmente.
        """
        async with self._lock:
            ahora = time.time()
            # Limpia timestamps fuera de la ventana de 60s
            ventana = ahora - 60.0
            self._timestamps = [t for t in self._timestamps if t > ventana]

            espera_total = 0.0

            # 1. Respeta el intervalo minimo entre requests
            if self._timestamps:
                desde_ultima = ahora - self._timestamps[-1]
                if desde_ultima < self._intervalo_minimo:
                    espera_total = self._intervalo_minimo - desde_ultima

            # 2. Respeta el maximo por minuto
            if len(self._timestamps) >= self._max_por_minuto:
                # Cuanto falta para que el mas antiguo salga de la ventana
                mas_antiguo = self._timestamps[0]
                falta_ventana = mas_antiguo + 60.0 - ahora
                if falta_ventana > espera_total:
                    espera_total = falta_ventana

            if espera_total > 0:
                logger.info(
                    f"RateLimiterIA: esperando {espera_total:.1f}s "
                    f"({len(self._timestamps)}/{self._max_por_minuto} usados en la ventana)"
                )
                await asyncio.sleep(espera_total)
                ahora = time.time()

            self._timestamps.append(ahora)
            return espera_total


# Instancia global compartida por todos los agentes y requests
limitador_ia = RateLimiterIA(
    max_por_minuto=GEMINI_MAX_RPM,
    intervalo_minimo=GEMINI_MIN_INTERVAL,
)


def _cargar_clasificaciones() -> list[dict]:
    """Carga el catalogo de clasificaciones arancelarias desde el JSON local."""
    ruta = os.path.join(os.path.dirname(os.path.dirname(__file__)), "datos_clasificacion.json")
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def _clasificar_local(descripcion: str) -> Optional[dict]:
    """Clasifica un producto buscando palabras clave en el catalogo local.
    Si no encuentra coincidencia, devuelve una clasificacion generica por defecto.
    """
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
        "justificacion": "Clasificado provisionalmente en el Capitulo 85 por tratarse de manufacturas electricas/electronicas de transmision de telecomunicaciones. Requiere mayor informacion tecnica sobre potencia y modulacion. RGI 1.",
        "suficiencia_legal": "INSUFICIENTE",
        "regla_aplicada": "RGI 2",
        "traduccion_tecnica": "Dispositivos inalambricos de comunicacion digital y transmision por radiofrecuencia",
        "rrna_requerida": False,
        "rrna_detalles": None,
    }


def _extraer_json_respuesta(texto_respuesta: str) -> dict:
    """Saca el JSON de la respuesta de Gemini, ignorando los bloques ```json ... ```."""
    if "```json" in texto_respuesta:
        texto_respuesta = texto_respuesta.split("```json")[1].split("```")[0].strip()
    elif "```" in texto_respuesta:
        texto_respuesta = texto_respuesta.split("```")[1].split("```")[0].strip()
    return json.loads(texto_respuesta)


async def _llamar_gemini(prompt: str, max_reintentos: int = 3) -> Optional[dict]:
    """Llama a la API de Gemini (modelo gemini-2.5-flash) con un prompt y devuelve la respuesta cruda.
    Antes de llamar, adquiere un turno del limitador de velocidad global (RateLimiterIA)
    para no superar el maximo de requests por minuto configurado.
    Si aun asi Gemini responde 429, reintenta hasta `max_reintentos` veces con backoff exponencial.
    Si no hay API key configurada, devuelve None (quien llama debe tener un fallback).
    """
    if not GEMINI_API_KEY:
        return None

    # Espera turno en la cola global para respetar el rate limit de Gemini
    await limitador_ia.adquirir()

    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    headers = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    for intento in range(max_reintentos):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                if intento < max_reintentos - 1:
                    espera = 2 ** (intento + 1)
                    logger.warning(f"Gemini 429 (intento {intento + 1}/{max_reintentos}), reintentando en {espera}s...")
                    await asyncio.sleep(espera)
                    continue
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="El servicio de inteligencia artificial esta saturado en este momento. "
                           "Espera unos segundos y vuelve a intentar.",
                )
            logger.error(f"Error HTTP en Gemini ({e.response.status_code}): {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Error en peticion a Gemini: {e}")
            return None

    return None


class AITextService:
    """Servicio que usa Gemini para estructurar texto de facturas y clasificar productos."""

    @staticmethod
    async def parse_invoice(raw_text: str) -> Optional[Dict[str, Any]]:
        """Toma el texto crudo de una factura y lo estructura en JSON con campos aduaneros.
        El prompt le pide a Gemini que identifique emisor, receptor, montos, items, incoterm, etc.
        """
        system_prompt = """
Eres un sistema de extraccion de datos para documentos de comercio exterior.
Tu objetivo es leer el texto de un documento aduanero y estructurarlo en formato JSON.

Instrucciones de Auditoria Estricta:
1. PRIORIDAD DE DIVISA: Identifica el codigo de moneda ISO 4217 (ej: USD, EUR, CNY) antes de procesar montos. No asumas USD.
2. JERARQUIA DE ITEMS: Realiza un analisis de diseno (layout) para alinear correctamente cada descripcion con su cantidad, valor unitario y valor total.
3. CLASIFICACION: Extrae codigos arancelarios (HS Code) de al menos 6 digitos. Si no existen, sugierelos basandote en la descripcion tecnica.
4. INCOTERMS: Busca terminos de la ICC (Incoterms 2020) como FOB, CIF, EXW, DAP, etc.
5. CUMPLIMIENTO CHILE: Si el receptor esta en Chile (CL), busca obligatoriamente el RUT o Tax ID.
6. ARITMETICA ADUANERA: Valida internamente que la suma de (items) + flete + seguro + otros sea igual al Total de la Factura en la moneda original.

Responde UNICAMENTE con un objeto JSON valido usando esta estructura:
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
      "partida_arancelaria_sugerida": "str (6+ digitos)"
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

        logger.info(f"Estructuracion completada. Tokens: {tokens_info['total']}")
        return {"data": data_parsed, "tokens": tokens_info}

    @staticmethod
    async def classify_item(descripcion_producto: str) -> Optional[Dict[str, Any]]:
        """Clasifica un producto en su partida arancelaria usando Gemini.
        Si Gemini no esta disponible, usa el catalogo local por palabras clave.
        """
        if not GEMINI_API_KEY:
            return _clasificar_local(descripcion_producto)

        system_prompt = """
Eres un clasificador arancelario aduanero experto de la OMA (Organizacion Mundial de Aduanas) y un traductor tecnico bilingue especializado en comercio exterior.
Tu tarea es recibir la descripcion comercial de un producto (que puede venir en ingles, aleman, chino, etc.) y realizar lo siguiente:
1. Clasificacion arancelaria mas probable (HS Code a 6 u 8 digitos).
2. Determinar una justificacion legal detallada basada en las Reglas Generales de Interpretacion (RGI) y las Notas de Seccion/Capitulo.
3. Realizar una TRADUCCION TECNICA Y FORMAL de la descripcion original al espanol tecnico aduanero oficial.
4. Detectar si la naturaleza del producto requiere Regulaciones y Restricciones No Arancelarias (RRNA) como permisos sanitarios (COFEPRIS, FDA, ISP), regulaciones ambientales de sustancias peligrosas o normas tecnicas oficiales obligatorias.

Responde UNICAMENTE con un objeto JSON valido con esta estructura exacta:
{
  "partida_sugerida": "str (HS Code, ej: 7318.15.99)",
  "descripcion_tarifa": "str (Descripcion oficial de la tarifa arancelaria)",
  "justificacion": "str (Explicacion tecnica detallada y mencion de RGI y Notas de Seccion)",
  "suficiencia_legal": "SUFICIENTE | INSUFICIENTE",
  "regla_aplicada": "str (ej: RGI 1 y RGI 6)",
  "traduccion_tecnica": "str (Traduccion tecnica formal al espanol aduanero de la descripcion del producto)",
  "rrna_requerida": boolean,
  "rrna_detalles": "str o null"
}
"""
        prompt_completo = f"{system_prompt}\n\n=== DESCRIPCION DEL PRODUCTO ===\n{descripcion_producto}"
        resultado = await _llamar_gemini(prompt_completo)

        if not resultado:
            return _clasificar_local(descripcion_producto)

        try:
            json_text = resultado["candidates"][0]["content"]["parts"][0]["text"]
            return _extraer_json_respuesta(json_text)
        except (KeyError, json.JSONDecodeError) as e:
            logger.error(f"Error parseando respuesta de Gemini: {e}")
            return _clasificar_local(descripcion_producto)
