import os
import json
import urllib.request
import urllib.error
from dotenv import load_dotenv
from typing import Dict, Any, Optional
from fastapi import HTTPException, status

# Cargar variables de entorno
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path)


class AITextService:
    """
    Servicio de estructuración de texto usando la API de Google Gemini.
    Recibe texto crudo extraído por OCR y lo convierte en datos estructurados (JSON)
    con campos específicos de comercio exterior.
    """

    @staticmethod
    async def parse_invoice(raw_text: str) -> Optional[Dict[str, Any]]:
        """
        Envía el texto OCR a Gemini para que lo interprete y devuelva
        un JSON con los datos de la factura (emisor, receptor, ítems, montos, etc.).
        """
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("ERROR: GEMINI_API_KEY no configurada.")
            return None

        # Prompt con instrucciones de extracción
        system_prompt = """
        Eres un sistema de extracción de datos para documentos de comercio exterior.
        Tu objetivo es leer el texto de un documento aduanero y estructurarlo en formato JSON.

        Instrucciones:
        1. Identifica al emisor (exportador) y al receptor (importador).
        2. Para cada uno, localiza su identificación fiscal (RUT, CUIT, VAT, etc.).
        3. Identifica costos de flete y seguro si existen.
        4. Extrae el monto total CIF (productos + flete + seguro).
        5. Extrae cada producto con su cantidad, precio unitario y sugiere un código arancelario (HS).

        Responde ÚNICAMENTE con un objeto JSON válido usando esta estructura:
        {
          "tipo_documento": "COMERCIAL_INVOICE | CUSTOMS_DECLARATION | OTHER",
          "numero_factura": "str",
          "fecha_emision": "str (YYYY-MM-DD)",
          "moneda": "str (ej: USD, EUR)",
          "monto_subtotal": float,
          "monto_total_cif": float,
          "monto_flete": float,
          "monto_seguro": float,
          "emisor": { "nombre": "str", "pais": "str", "direccion": "str", "tax_id": "str" },
          "receptor": { "nombre": "str", "pais": "str", "direccion": "str", "tax_id": "str" },
          "detalles": [
            {
              "descripcion_producto": "str",
              "cantidad": float,
              "precio_unitario": float,
              "partida_arancelaria_sugerida": "str"
            }
          ]
        }
        """

        # Llamada directa a la API REST de Google Gemini (modelo gemini-2.5-flash)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        
        prompt_completo = f"{system_prompt}\n\n=== TEXTO DEL DOCUMENTO ===\n{raw_text}\n=== FIN DEL TEXTO ==="
        payload = {
            "contents": [{"parts": [{"text": prompt_completo}]}]
        }
        
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        
        try:
            with urllib.request.urlopen(req) as response:
                result_json = json.loads(response.read().decode())
                
                # Extraer metadatos de consumo de tokens
                usage = result_json.get("usageMetadata", {})
                tokens_info = {
                    "input": usage.get("promptTokenCount", 0),
                    "output": usage.get("candidatesTokenCount", 0),
                    "total": usage.get("totalTokenCount", 0)
                }

                # Extraer y limpiar el JSON de la respuesta
                json_text = result_json["candidates"][0]["content"]["parts"][0]["text"]
                if "```json" in json_text:
                    json_text = json_text.split("```json")[1].split("```")[0].strip()
                elif "```" in json_text:
                    json_text = json_text.split("```")[1].split("```")[0].strip()
                    
                print(f"Estructuración completada. Tokens utilizados: {tokens_info['total']}")
                
                data_parsed = json.loads(json_text)
                return {
                    "data": data_parsed,
                    "tokens": tokens_info
                }

        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            print(f"Error en la API de Google ({e.code}): {error_body}")
            if e.code == 429:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Se alcanzó el límite de peticiones. Espera un momento e intenta de nuevo."
                )
            return None

        except Exception as e:
            print(f"Error general en la petición: {str(e)}")
            return None
