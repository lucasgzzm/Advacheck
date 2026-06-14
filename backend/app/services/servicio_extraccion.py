import pdfplumber
import re
import io
import asyncio
from typing import Dict, Any, List
import json
from fastapi import HTTPException, status
from .servicio_ocr import OCRService
from .servicio_texto import AITextService
from ..utilidades import verificar_cuadre_cif


class ExtractorService:
    """Coordinador de la extraccion de datos de facturas PDF.
    Paso 1: pdfplumber + Azure OCR extraen el texto del PDF.
    Paso 2: Gemini estructura ese texto en campos aduaneros (emisor, receptor, montos, items).
    Si algun paso falla, se aborta para no guardar datos incorrectos.
    """

    @staticmethod
    async def extract_from_pdf(file_bytes: bytes) -> Dict[str, Any]:
        """Punto de entrada: recibe el PDF en bytes, devuelve el diccionario con todos los datos extraidos."""

        # 1. Extraer texto del PDF (primero local con pdfplumber, luego Azure OCR si hace falta)
        texto_crudo = None
        try:
            texto_crudo = await OCRService.extract_text(file_bytes)
            print(f"OCR exitoso. Longitud del texto: {len(texto_crudo)} caracteres.")
        except Exception as e:
            print(f"Error en Azure OCR: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Fallo en la lectura del documento (OCR). Detalle: {str(e)}"
            )

        # 2. Mandar el texto a Gemini para que lo estructure en JSON
        ai_response = await AITextService.parse_invoice(texto_crudo)

        tokens = None
        data = None

        if ai_response and "data" in ai_response:
            data = ai_response["data"]
            tokens = ai_response.get("tokens")

        if data:
            print("Estructuracion de datos completada.")
        else:
            print("Fallo en la estructuracion. Abortando extraccion.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="El servicio de analisis de texto fallo o esta saturado. Se cancelo la extraccion para evitar datos incorrectos."
            )

        # 3. Verificar que los datos tengan sentido (cuadratura CIF)
        data = ExtractorService._validate_integrity(data)

        # Adjuntar metadatos de tokens para mostrarlos en el frontend
        if tokens:
            data["_ai_metadata"] = tokens

        return data

    @staticmethod
    def _validate_integrity(data: Dict[str, Any]) -> Dict[str, Any]:
        """Verifica que subtotal + flete + seguro + otros aproximadamente igual al total CIF."""
        items = data.get("detalles", [])
        subtotal = sum(
            float(item.get("cantidad", 0)) * float(item.get("precio_unitario", 0))
            for item in items
        )
        flete = float(data.get("monto_flete", 0) or 0)
        seguro = float(data.get("monto_seguro", 0) or 0)
        otros = float(data.get("monto_otros_gastos", 0) or 0)
        total_declarado = float(data.get("monto_total_cif", 0) or 0)

        cuadra, diff, mensaje = verificar_cuadre_cif(subtotal, flete, seguro, otros, total_declarado)
        data["validacion_error"] = not cuadra
        if not cuadra:
            data["mensaje_error"] = mensaje

        return data
