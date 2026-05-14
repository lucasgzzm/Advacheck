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

    @staticmethod
    async def cross_validate_documents(raw_texts: list[str]) -> Optional[Dict[str, Any]]:
        """Envía múltiples textos a Gemini para validación cruzada."""
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return None

        system_prompt = """
        Eres un auditor experto de aduanas. Se te proporcionará el texto extraído de varios documentos de una misma operación de importación (por ejemplo, Factura Comercial, Bill of Lading, Packing List).
        
        Tu tarea es:
        1. Identificar qué tipo de documentos se proporcionaron.
        2. Realizar una validación cruzada:
           - ¿El exportador/importador coincide en todos los documentos?
           - ¿El peso bruto, neto o cantidad de bultos coincide?
           - ¿Los montos totales o valores coinciden?
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

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        
        text_combinado = ""
        for i, txt in enumerate(raw_texts):
            text_combinado += f"\n\n=== DOCUMENTO {i+1} ===\n{txt}\n=== FIN DOCUMENTO {i+1} ==="
            
        prompt_completo = f"{system_prompt}\n{text_combinado}"
        payload = {
            "contents": [{"parts": [{"text": prompt_completo}]}]
        }
        
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        
        try:
            with urllib.request.urlopen(req) as response:
                result_json = json.loads(response.read().decode())
                json_text = result_json["candidates"][0]["content"]["parts"][0]["text"]
                if "```json" in json_text:
                    json_text = json_text.split("```json")[1].split("```")[0].strip()
                elif "```" in json_text:
                    json_text = json_text.split("```")[1].split("```")[0].strip()
                return json.loads(json_text)
        except Exception as e:
            print(f"Error en validación cruzada: {str(e)}")
            return None
