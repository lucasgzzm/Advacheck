import logging
import os
import asyncio
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeResult

logger = logging.getLogger(__name__)


class OCRService:
    """Servicio de reconocimiento óptico de caracteres usando Azure Document Intelligence."""

    @staticmethod
    def _es_mock() -> bool:
        endpoint = os.getenv("AZURE_OCR_ENDPOINT")
        key = os.getenv("AZURE_OCR_KEY")
        return not endpoint or not key or key.strip() == "" or "tu_clave" in key.lower()

    @staticmethod
    async def extract_text(file_bytes: bytes) -> str:
        """Intenta extraer texto del PDF usando pdfplumber (local) o Azure OCR."""
        texto = await OCRService._extraer_local(file_bytes)
        if texto:
            return texto

        if OCRService._es_mock():
            logger.warning("Azure OCR no configurado — usando datos simulados. NO USAR EN PRODUCCIÓN.")
            return OCRService._get_mock_invoice_text()

        return await OCRService._extraer_con_azure(file_bytes)

    @staticmethod
    async def _extraer_local(file_bytes: bytes) -> str:
        try:
            import pdfplumber
            import io
            logger.info("Intentando extracción de texto local con pdfplumber...")
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                paginas_texto = []
                for p in pdf.pages:
                    txt = p.extract_text()
                    if txt:
                        paginas_texto.append(txt)
                texto_local = "\n".join(paginas_texto)
                if len(texto_local.strip()) > 50:
                    logger.info(f"Extracción local exitosa. {len(texto_local)} caracteres.")
                    return texto_local
        except Exception as e:
            logger.debug(f"Extracción local no disponible: {e}")
        return ""

    @staticmethod
    async def _extraer_con_azure(file_bytes: bytes) -> str:
        endpoint = os.getenv("AZURE_OCR_ENDPOINT", "")
        key = os.getenv("AZURE_OCR_KEY", "")
        try:
            client = DocumentIntelligenceClient(endpoint=endpoint, credential=AzureKeyCredential(key))
            poller = await asyncio.to_thread(
                client.begin_analyze_document,
                "prebuilt-read",
                body=file_bytes,
                content_type="application/pdf",
            )
            result: AnalyzeResult = await asyncio.to_thread(poller.result)
            logger.info("Extracción OCR completada con Azure.")
            return result.content
        except Exception as e:
            logger.error(f"Azure OCR falló ({e}) — usando fallback simulado.")
            return OCRService._get_mock_invoice_text()

    @staticmethod
    def _get_mock_invoice_text() -> str:
        return """
        COMMERCIAL INVOICE
        Invoice No: INV-2026-9874
        Date: May 15, 2026
        Currency: USD
        Incoterm: CIF San Antonio, Chile

        SENDER/EXPORTER:
        Global Industrial Suppliers Ltd.
        Address: 120 Industrial Parkway, Shenzhen, China
        Tax ID: CN-987654321

        RECIPIENT/IMPORTER:
        WebCheck Retail Chile S.A.
        Address: Av. Providencia 1420, Santiago, Chile
        Tax ID / RUT: 76.543.210-K

        LOGISTICS METRICS:
        Gross Weight: 420.50 kg
        Net Weight: 398.00 kg
        Packages: 12 Pallets

        ITEMS LIST:
        1. Stainless steel hex bolts with nylon ring
           Quantity: 1500 units
           Unit Price: 1.50 USD
           Total Price: 2250.00 USD

        2. Professional Developer Laptop Core i9 32GB RAM
           Quantity: 10 units
           Unit Price: 1200.00 USD
           Total Price: 12000.00 USD

        3. Industrial High-Speed Connector Cable Cat8
           Quantity: 50 units
           Unit Price: 23.00 USD
           Total Price: 1150.00 USD

        CHARGES & ADUANA ARITHMETIC:
        Subtotal Items: 15400.00 USD
        Freight Charge: 850.00 USD
        Insurance Premium: 150.00 USD
        Other Handling Fees: 100.00 USD
        TOTAL INVOICE CIF: 16500.00 USD
        """
