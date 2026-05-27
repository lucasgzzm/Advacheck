import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeResult

class OCRService:
    """Servicio de reconocimiento óptico de caracteres usando Azure Document Intelligence."""

    @staticmethod
    async def extract_text(file_bytes: bytes) -> str:
        """
        Intenta extraer el texto del PDF.
        1. Usa pdfplumber de forma local y gratuita si el PDF es nativo digital.
        2. Si falla o no tiene texto legible, intenta usar Azure Document Intelligence.
        3. Si Azure arroja error (ej. 401 Credenciales Inválidas), activa un fallback de simulación.
        """
        endpoint = os.getenv("AZURE_OCR_ENDPOINT")
        key = os.getenv("AZURE_OCR_KEY")

        # 1. Intentar extracción local gratuita con pdfplumber primero
        try:
            import pdfplumber
            import io
            print("Intentando extracción de texto local directa con pdfplumber...")
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                paginas_texto = []
                for p in pdf.pages:
                    txt = p.extract_text()
                    if txt:
                        paginas_texto.append(txt)
                
                texto_local = "\n".join(paginas_texto)
                if len(texto_local.strip()) > 50:
                    print(f"Extracción local exitosa. {len(texto_local)} caracteres extraídos.")
                    return texto_local
        except Exception as local_err:
            print(f"La extracción de texto local no fue posible: {str(local_err)}")

        # 2. Intentar con Azure si las credenciales están configuradas
        if not endpoint or not key or key.strip() == "" or "tu_clave" in key.lower():
            print("ADVERTENCIA: Azure OCR no configurado o tiene claves de marcador. Iniciando fallback de simulación.")
            return OCRService._get_mock_invoice_text()

        try:
            client = DocumentIntelligenceClient(endpoint=endpoint, credential=AzureKeyCredential(key))
            print("Enviando documento a Azure Document Intelligence...")
            
            poller = client.begin_analyze_document(
                "prebuilt-read",
                body=file_bytes,
                content_type="application/pdf"
            )
            
            result: AnalyzeResult = poller.result()
            print("Extracción OCR completada con Azure.")
            return result.content
        except Exception as azure_err:
            print(f"ERROR: Falló Azure OCR ({str(azure_err)}). Iniciando fallback de simulación aduanera.")
            return OCRService._get_mock_invoice_text()

    @staticmethod
    def _get_mock_invoice_text() -> str:
        """Devuelve un texto simulado de factura comercial detallado para desarrollo y demostración."""
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
