import pdfplumber
import re
import io
import asyncio
from typing import Dict, Any, List
from fastapi import HTTPException, status
from .servicio_ocr import OCRService
from .servicio_texto import AITextService
from .prefiltro import filtrar_paginas_relevantes

class ExtractorService:

    @staticmethod
    async def extract_from_pdf(file_bytes: bytes) -> Dict[str, Any]:

        texto_crudo = None
        pages = None
        filtro_metrics = None
        try:
            pages = await OCRService.extract_text_per_page(file_bytes)

            filtro = filtrar_paginas_relevantes(pages)
            pages_filtradas = filtro["pages"]
            filtro_metrics = filtro["metrics"]

            if len(pages_filtradas) != len(pages):
                print(
                    f"Prefiltro: {len(pages)} -> {len(pages_filtradas)} paginas "
                    f"({filtro_metrics['reduccion_pct']}% reduccion)"
                )
                for exc in filtro_metrics["paginas_excluidas"]:
                    print(f"  Excluida P{exc['page_num']}: {exc['clase']}")

            pages_para_ai = pages_filtradas
            texto_crudo = "\n".join(p["text"] for p in pages_para_ai)
            print(f"OCR exitoso. {len(pages_para_ai)} pagina(s), {len(texto_crudo)} caracteres.")
            tipos_detectados = []
            for p in pages_para_ai:
                primer_linea = p["text"].strip().split("\n")[0][:80] if p["text"].strip() else "(vacio)"
                tipos_detectados.append(f"P{p['page_num']}: {primer_linea}")
            print(f"Paginas detectadas: {' | '.join(tipos_detectados)}")
        except Exception as e:
            print(f"Error en Azure OCR: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo leer el documento. El archivo podría estar dañado, ser ilegible o no ser un PDF válido."
            )

        ai_response = await AITextService.parse_invoice(texto_crudo, pages=pages_para_ai)

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

        data = ExtractorService._validate_integrity(data)

        packing_list = data.pop("packing_list", None)
        bl_data = data.pop("bl", None)

        if packing_list:
            data["_packing_list"] = packing_list
            print(f"Packing List detectado: {packing_list.get('bultos', '?')} bultos, {packing_list.get('peso_bruto', '?')}kg")
        else:
            print("No se detecto Packing List en ninguna pagina.")

        if bl_data:
            data["_bl_data"] = bl_data
            print(f"BL/AWB detectado por IA: {bl_data.get('bultos', '?')} bultos, {bl_data.get('peso_bruto', '?')}kg")
        else:
            print("BL/AWB no detectado por IA. Buscando paginas con keywords de documento de transporte...")
            bl_data = await ExtractorService._try_extract_bl_from_pages(pages, file_bytes)
            if bl_data:
                data["_bl_data"] = bl_data
                print(f"BL/AWB detectado en pagina combinada: {bl_data.get('bultos', '?')} bultos, {bl_data.get('peso_bruto', '?')}kg")
            else:
                print("No se encontro BL/AWB en ninguna pagina del PDF.")

        if not data.get("transporte_metodo") and data.get("_bl_data"):
            transport_mode = data["_bl_data"].get("metodo_transporte")
            if transport_mode:
                data["transporte_metodo"] = transport_mode
                print(f"Modo de transporte inferido de BL: {transport_mode}")

        if tokens:
            ai_meta = dict(tokens)
            if filtro_metrics:
                ai_meta["prefiltro"] = filtro_metrics
            data["_ai_metadata"] = ai_meta

        return data

    @staticmethod
    async def _try_extract_bl_from_pages(all_pages: List[dict], file_bytes: bytes) -> Optional[Dict[str, Any]]:
        BL_KEYWORDS = [
            "OCEAN BILL OF LADING", "BILL OF LADING", "BILL OF LADING NUMBER",
            "MASTER BILL OF LADING", "HOUSE BILL OF LADING", "CONOCIMIENTO DE EMBARQUE",
            "AIR WAYBILL", "AIR WAY BILL", "AWB NUMBER",
            "CARTA PORTE", "CARNÉ TIR", "CARTE DE PORT", "CMR", "TRUCK",
            "PORT OF LOADING", "PORT OF DISCHARGE", "VESSEL",
            "SHIPPER", "CONSIGNEE", "NOTIFY PARTY",
            "GROSS WEIGHT", "GROSS WT",
        ]
        bl_pages = []
        for p in all_pages:
            text_upper = p["text"].upper()
            if any(kw in text_upper for kw in BL_KEYWORDS):
                bl_pages.append(p)
        if not bl_pages:
            return None

        bl_text = "\n".join(p["text"] for p in bl_pages)
        tipos = [f"P{p['page_num']}" for p in bl_pages]
        print(f"Paginas con posible BL: {', '.join(tipos)} ({len(bl_text)} caracteres)")

        return await AITextService.parse_bl(bl_text)

    @staticmethod
    def _validate_integrity(data: Dict[str, Any]) -> Dict[str, Any]:
        items = data.get("detalles", [])
        subtotal = sum(
            float(item.get("cantidad", 0)) * float(item.get("precio_unitario", 0))
            for item in items
        )
        flete = float(data.get("monto_flete", 0) or 0)
        seguro = float(data.get("monto_seguro", 0) or 0)
        otros = float(data.get("monto_otros_gastos", 0) or 0)
        subtotal_declarado = float(data.get("monto_subtotal", 0) or 0)
        total_declarado = float(data.get("monto_total_cif", 0) or 0)

        subtotal_real = subtotal_declarado if subtotal_declarado > 0 else subtotal

        tiene_cargos = (flete > 0 or seguro > 0 or otros > 0)

        if total_declarado > 0 and not tiene_cargos:
            calculado = subtotal_real
            tolerancia = max(2.0, total_declarado * 0.02)
            if abs(calculado - total_declarado) <= tolerancia:
                data["validacion_error"] = False
            else:
                data["validacion_error"] = True
                data["mensaje_error"] = (
                    f"Subtotal({subtotal_real:.2f}) vs Total({total_declarado:.2f}). "
                    f"Diferencia: {calculado - total_declarado:.2f}."
                )
        elif total_declarado > 0 and tiene_cargos:
            calculado = subtotal_real + flete + seguro + otros
            tolerancia = max(2.0, total_declarado * 0.02)
            if abs(calculado - total_declarado) <= tolerancia:
                data["validacion_error"] = False
            else:
                data["validacion_error"] = True
                data["mensaje_error"] = (
                    f"Subtotal({subtotal_real:.2f}) + Flete({flete}) + Seguro({seguro}) + Otros({otros}) = {calculado:.2f} "
                    f"vs Total({total_declarado:.2f}). Diferencia: {calculado - total_declarado:.2f}."
                )
        else:
            data["validacion_error"] = False
            data["mensaje_error"] = None

        return data
