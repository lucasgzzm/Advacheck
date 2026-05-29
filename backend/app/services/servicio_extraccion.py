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
    """
    Servicio coordinador de extracción de datos de facturas PDF.
    Paso 1: Azure Document Intelligence extrae el texto del PDF.
    Paso 2: Gemini estructura el texto en campos aduaneros.
    Si algún paso falla, se aborta la operación para evitar datos incorrectos.
    """

    @staticmethod
    async def extract_from_pdf(file_bytes: bytes) -> Dict[str, Any]:
        """Punto de entrada principal. Coordina la extracción y validación."""

        # 1. Extracción de texto mediante OCR (Azure)
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

        # 2. Estructuración del texto con Gemini
        ai_response = await AITextService.parse_invoice(texto_crudo)

        tokens = None
        data = None
        
        if ai_response and "data" in ai_response:
            data = ai_response["data"]
            tokens = ai_response.get("tokens")

        if data:
            print("Estructuración de datos completada.")
        else:
            print("Fallo en la estructuración. Abortando extracción.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="El servicio de análisis de texto falló o está saturado. Se canceló la extracción para evitar datos incorrectos."
            )

        # 3. Validación de integridad de los datos
        data = ExtractorService._validate_integrity(data)
        
        # Adjuntar metadatos de tokens para el frontend
        if tokens:
            data["_ai_metadata"] = tokens
        
        return data

    @staticmethod
    def _validate_integrity(data: Dict[str, Any]) -> Dict[str, Any]:
        """Verifica que la suma de items + flete + seguro + otros cuadre con el total CIF declarado."""
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

