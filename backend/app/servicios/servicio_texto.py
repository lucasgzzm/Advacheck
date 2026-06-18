import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, Optional

import httpx

from ..configuracion import GEMINI_API_KEY, GEMINI_MIN_INTERVAL

logger = logging.getLogger(__name__)


# Carga el archivo JSON de clasificaciones arancelarias locales
def _cargar_clasificaciones() -> list[dict]:
    ruta = os.path.join(os.path.dirname(os.path.dirname(__file__)), "datos_clasificacion.json")
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)

# Clasifica producto por descripcion usando palabras clave locales
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
        "justificacion": "Clasificado provisionalmente en el Capitulo 85 por tratarse de manufacturas electricas/electronicas de transmision de telecomunicaciones. Requiere mayor informacion tecnica sobre potencia y modulacion. RGI 1.",
        "suficiencia_legal": "INSUFICIENTE",
        "regla_aplicada": "RGI 2",
        "traduccion_tecnica": "Dispositivos inalambricos de comunicacion digital y transmision por radiofrecuencia",
        "rrna_requerida": False,
        "rrna_detalles": None,
    }

# Extrae y parsea el JSON de la respuesta de Gemini eliminando markdown
def _extraer_json_respuesta(texto_respuesta: str) -> dict:
    if "```json" in texto_respuesta:
        texto_respuesta = texto_respuesta.split("```json")[1].split("```")[0].strip()
    elif "```" in texto_respuesta:
        texto_respuesta = texto_respuesta.split("```")[1].split("```")[0].strip()
    return json.loads(texto_respuesta)

_ultima_llamada_gemini = 0.0
_lock_gemini = asyncio.Lock()

# Espera el tiempo minimo entre llamadas a Gemini para respetar el rate limit
async def _esperar_intervalo():
    global _ultima_llamada_gemini
    async with _lock_gemini:
        ahora = time.time()
        desde_ultima = ahora - _ultima_llamada_gemini
        if desde_ultima < GEMINI_MIN_INTERVAL:
            espera = GEMINI_MIN_INTERVAL - desde_ultima
            logger.debug(f"Esperando {espera:.1f}s antes de llamar a Gemini (rate limit)")
            await asyncio.sleep(espera)
        _ultima_llamada_gemini = time.time()

# Cache global para el estado de la API de Gemini
_estado_gemini = {
    "online": True,
    "motivo": None,
    "ultimo_chequeo": 0.0,
    "rate_limited": False,
    "retry_after": None
}

# Extrae el tiempo de espera sugerido en respuestas 429 de Gemini
def _extraer_retry_delay(respuesta: dict) -> Optional[float]:
    detalles = respuesta.get("error", {}).get("details", [])
    for d in detalles:
        if "RetryInfo" in d.get("@type", ""):
            retry = d.get("retryDelay", "")
            if retry.endswith("s"):
                try:
                    return float(retry.rstrip("s"))
                except ValueError:
                    pass
    return None

# Devuelve el estado cacheado de Gemini sin llamar a la API real
async def obtener_estado_gemini() -> dict:
    global _estado_gemini
    ahora = time.time()

    if not GEMINI_API_KEY:
        _estado_gemini = {
            "online": False,
            "motivo": "API Key de Gemini no configurada",
            "ultimo_chequeo": ahora,
            "rate_limited": False,
            "retry_after": None
        }
        return _estado_gemini

    # Cache adaptativo según el estado
    if _estado_gemini.get("rate_limited"):
        ttl = 300.0
    elif _estado_gemini["online"]:
        ttl = 120.0
    else:
        ttl = 60.0

    if ahora - _estado_gemini["ultimo_chequeo"] < ttl:
        return _estado_gemini

    # Cache expirado: no llamamos a Gemini, solo devolvemos estado "incierto" como online
    # para no bloquear subidas. Si realmente hay 429, _llamar_gemini lo detectará.
    _estado_gemini = {
        "online": True,
        "motivo": None,
        "ultimo_chequeo": ahora,
        "rate_limited": False,
        "retry_after": None
    }
    return _estado_gemini

# Llama a la API de Gemini con reintentos y control de rate limit
async def _llamar_gemini(prompt: str, max_reintentos: int = 3) -> Optional[dict]:
    global _estado_gemini
    if not GEMINI_API_KEY:
        _estado_gemini = {
            "online": False,
            "motivo": "API Key de Gemini no configurada",
            "ultimo_chequeo": time.time(),
            "rate_limited": False,
            "retry_after": None
        }
        return None

    await _esperar_intervalo()

    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    headers = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    for intento in range(max_reintentos):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                # Éxito: actualizamos estado
                _estado_gemini = {
                    "online": True,
                    "motivo": None,
                    "ultimo_chequeo": time.time(),
                    "rate_limited": False,
                    "retry_after": None
                }
                return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                retry_after = 30.0
                try:
                    body = e.response.json()
                    extraido = _extraer_retry_delay(body)
                    if extraido is not None:
                        retry_after = extraido
                except Exception:
                    pass
                _estado_gemini = {
                    "online": False,
                    "motivo": "Límite de consultas a IA por alta demanda",
                    "ultimo_chequeo": time.time(),
                    "rate_limited": True,
                    "retry_after": retry_after
                }
                if intento < max_reintentos - 1:
                    espera = min(2 ** (intento + 1), retry_after)
                    logger.warning(f"Gemini 429 (intento {intento + 1}/{max_reintentos}), reintentando en {espera:.0f}s...")
                    await asyncio.sleep(espera)
                    continue
                logger.error(f"Gemini 429: cuota agotada, reintentos agotados. retry_after={retry_after}s")
                return None
            _estado_gemini = {
                "online": False,
                "motivo": f"Servicio de IA fuera de servicio (Código {e.response.status_code})",
                "ultimo_chequeo": time.time(),
                "rate_limited": False,
                "retry_after": None
            }
            logger.error(f"Error HTTP en Gemini ({e.response.status_code}): {e.response.text}")
            return None
        except Exception as e:
            _estado_gemini = {
                "online": False,
                "motivo": "Error de conexión con el servicio de IA",
                "ultimo_chequeo": time.time(),
                "rate_limited": False,
                "retry_after": None
            }
            logger.error(f"Error en peticion a Gemini: {e}")
            return None

    return None

# Servicio de texto con IA para extraer datos de facturas, BL y clasificar productos
class AITextService:

    @staticmethod
    async def obtener_estado() -> dict:
        return await obtener_estado_gemini()

    # Parsea el texto de una factura comercial usando Gemini y devuelve datos estructurados
    @staticmethod
    async def parse_invoice(raw_text: str, pages: Optional[list[dict]] = None) -> Optional[Dict[str, Any]]:
        if pages:
            from .servicio_ocr import OCRService
            raw_text = OCRService.build_page_marked_text(pages)

        system_prompt = """
Eres un sistema de extraccion de datos para documentos de comercio exterior.
Tu objetivo es leer el texto de un documento comercial y estructurarlo en formato JSON.
La salida debe ser 100% determinista: dado el mismo texto de entrada, siempre debes producir exactamente el mismo JSON, aplicando las reglas logicas que se indican abajo.

TIPOS DE DOCUMENTO:
- Pueden ser facturas comerciales completas (con incoterm, flete, seguro, partidas arancelarias)
- O boletas simplificadas / facturas simples (sin datos de comercio exterior)
- Adapta la extraccion segun el tipo: si el documento es simple, los campos de comercio exterior no estaran presentes

MULTIPLES DOCUMENTOS EN UNA SOLA SUBIDA:
- Un PDF puede contener varias paginas, cada una con un tipo de documento distinto.
- Las paginas estan delimitadas con === PAGE X === en el texto.
- Identifica CADA pagina por separado segun su contenido:
  - COMERCIAL_INVOICE: Factura comercial con datos de exportacion/importacion
  - PACKING_LIST: Lista de empaque con pesos, bultos y detalle de productos
  - BILL_OF_LADING: Conocimiento de embarque (maritimo BL o aereo AWB) con datos de transporte
  - CUSTOMS_DECLARATION: Declaracion aduanera
  - OTHER: Otro tipo de documento
- Los campos principales (numero_factura, montos, etc.) corresponden SOLO a la pagina de tipo COMERCIAL_INVOICE.
- Para las paginas de tipo PACKING_LIST y BILL_OF_LADING, extrae sus datos en los campos adicionales "packing_list" y "bl".

REGLAS ESTRICTAS (aplicar en este orden antes de armar el JSON):

1. CONSISTENCIA MATEMATICA EN PARTIDAS: Para cada item del detalle, la ecuacion Cantidad * Precio Unitario = Valor Total debe cumplirse siempre.
   - Si la cantidad es 0 o esta vacia pero el precio unitario y el valor total del item son validos, calcula la cantidad como Valor Total / Precio Unitario.
   - Si el precio unitario es 0 o esta vacio pero la cantidad y el valor total del item son validos, calcula el precio unitario como Valor Total / Cantidad.
   - Redondea los resultados calculados a 2 decimales.

2. INVARIABILIDAD POR ALINEACION: No te bases en la posicion vertical de barras divisorias (|) ni en columnas fijas para asociar datos dentro de la tabla de items. En su lugar, identifica cada linea por su contexto semantico: primero la descripcion del producto, luego el codigo arancelario (si existe), luego la cantidad, luego los valores (unitario y total). Las tablas en facturas reales pueden tener espaciado irregular o caracteres decorativos; usa el significado de cada numero para asignarlo al campo correcto.

3. CUADRATURA FINANCIERA FIJA: El campo monto_total_cif debe ser estrictamente igual a monto_subtotal + monto_flete + monto_seguro + monto_otros_gastos.
   - Si la suma de los valores totales de las partidas (valor_total_item) no coincide con el monto_subtotal declarado en la seccion de totales del documento, dale prioridad al monto_subtotal explicito de la seccion de totales.
   - Los montos de flete, seguro y otros gastos se extraen de sus secciones correspondientes en el documento. Si no aparecen, usa 0.

4. PRIORIDAD DE DIVISA: Identifica el codigo de moneda ISO 4217 (ej: USD, EUR, CNY, CLP) antes de procesar montos. No asumas USD.

5. CLASIFICACION: Extrae codigos arancelarios (HS Code) solo si aparecen explicitamente. Si no existen, deja null.

6. INCOTERMS: Busca terminos de la ICC (Incoterms 2020) como FOB, CIF, EXW, DAP, etc. Si el documento no tiene incoterm, deja null.

7. CUMPLIMIENTO CHILE: Si el receptor esta en Chile (CL), busca el RUT o Tax ID si esta presente.

8. Para campos numericos que no aparezcan en el documento, usa 0.
   Para campos de texto o de objeto (como incoterm, pesos, partida_arancelaria_sugerida) que no aparezcan, usa null.

9. La fecha puede estar en formato YYYY-MM-DD, DD/MM/YYYY, o DD-MM-YYYY. Normalizala siempre a YYYY-MM-DD.

10. Todo el texto de salida debe estar en espanol neutro.

11. TRANSPORTE: El campo "transporte_metodo" debe indicar el modo de transporte principal del documento. "MARITIMO" si el documento menciona BILL OF LADING, VESSEL, BARCO, PUERTO, OCEAN, MARITIMO, CONOCIMIENTO DE EMBARQUE. "AEREO" si menciona AIR WAYBILL, AWB, VUELO, FLIGHT, AEROPUERTO, AEREO. "TERRESTRE" si menciona CARTA PORTE, CARNÉ TIR, CMR, TRUCK, CAMION. null si no hay suficiente informacion. Siempre en MAYUSCULAS y uno de esos cuatro valores.

Responde UNICAMENTE con un objeto JSON valido usando esta estructura:
{
  "tipo_documento": "COMERCIAL_INVOICE | BOLETA | CUSTOMS_DECLARATION | OTHER",
  "numero_factura": "str o null",
  "fecha_emision": "str (YYYY-MM-DD) o null",
  "moneda": "str (ISO 4217) o null",
  "incoterm": "str o null (solo si el documento lo menciona explicitamente)",
  "pais_origen": "str o null",
  "monto_subtotal": 0.0,
  "monto_total_cif": 0.0,
  "monto_flete": 0.0,
  "monto_seguro": 0.0,
  "monto_otros_gastos": 0.0,
  "transporte_metodo": "MARITIMO | AEREO | TERRESTRE | null",
  "pesos": { "bruto": 0.0, "neto": 0.0, "unidad": null } | null,
  "emisor": { "nombre": "str o null", "pais": "str o null", "direccion": "str o null", "tax_id": "str o null" },
  "receptor": { "nombre": "str o null", "pais": "str o null", "direccion": "str o null", "tax_id": "str o null", "email": "str o null" },
  "detalles": [
    {
      "descripcion_producto": "str",
      "cantidad": 0.0,
      "precio_unitario": 0.0,
      "valor_total_item": 0.0,
      "partida_arancelaria_sugerida": null
    }
  ],
  "packing_list": {
    "peso_bruto": 0.0,
    "peso_neto": 0.0,
    "bultos": 0,
    "detalles": [{"descripcion_producto": "", "cantidad": 0}]
  } | null,
  "bl": {
    "peso_bruto": 0.0,
    "bultos": 0,
    "metodo_transporte": "MARITIMO | AEREO | TERRESTRE | null",
    "shipper": {"nombre": "", "direccion": ""},
    "consignee": {"nombre": "", "direccion": ""}
  } | null
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

    # Parsea el texto de un BL o AWB usando Gemini y extrae datos de transporte
    @staticmethod
    async def parse_bl(raw_text: str) -> Optional[Dict[str, Any]]:
        system_prompt = """
Eres un sistema de extraccion de datos para Conocimientos de Embarque (Bill of Lading / AWB).
Tu objetivo es leer el texto de un documento de transporte y extraer los siguientes campos en formato JSON.

CAMPOS A EXTRAER:
- peso_bruto: Peso bruto total de la carga en kg (numero). Busca "Gross Weight", "Gross Wt", "Peso Bruto", "Weight".
- bultos: Numero total de bultos/piezas (numero entero). Busca "Total Packages", "Number of Pieces", "Bultos", "Packages", "Pieces".
- metodo_transporte: Modo de transporte. "MARITIMO" si el documento dice BILL OF LADING, OCEAN, VESSEL, MARITIMO, PUERTO, BARCO. "AEREO" si dice AIR WAYBILL, AWB, AEREO, VUELO, FLIGHT. "TERRESTRE" si dice CARTA PORTE, CARNÉ TIR, CMR, TRUCK, CAMION, TERRESTRE. null si no se puede determinar.
- shipper: Objeto con "nombre" (nombre del exportador/remitente) y "direccion" (direccion completa).
- consignee: Objeto con "nombre" (nombre del importador/destinatario) y "direccion" (direccion completa).

Reglas:
- Si un campo no aparece en el texto, usa null.
- Los valores numericos deben ser numeros (no strings).
- El peso bruto debe estar en kg; si aparece en libras, multiplica por 0.453592.
- metodo_transporte debe ser siempre MAYUSCULAS, uno de los tres valores enumerados.
- Responde UNICAMENTE con un objeto JSON valido, sin markdown ni comillas adicionales.

Estructura exacta:
{"peso_bruto": 0.0, "bultos": 0, "metodo_transporte": "MARITIMO | AEREO | TERRESTRE | null", "shipper": {"nombre": "", "direccion": ""}, "consignee": {"nombre": "", "direccion": ""}}
"""
        prompt_completo = f"{system_prompt}\n\n=== TEXTO DEL DOCUMENTO DE TRANSPORTE ===\n{raw_text}\n=== FIN DEL TEXTO ==="
        resultado = await _llamar_gemini(prompt_completo)
        if not resultado:
            return None
        try:
            json_text = resultado["candidates"][0]["content"]["parts"][0]["text"]
            return _extraer_json_respuesta(json_text)
        except (KeyError, json.JSONDecodeError) as e:
            logger.error(f"Error parseando respuesta BL de Gemini: {e}")
            return None

    # Clasifica un producto arancelariamente por su descripcion usando Gemini o fallback local
    @staticmethod
    async def classify_item(descripcion_producto: str) -> Optional[Dict[str, Any]]:
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
