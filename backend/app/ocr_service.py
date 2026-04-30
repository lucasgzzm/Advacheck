import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeResult
from dotenv import load_dotenv

# Cargar variables de entorno desde el archivo .env
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=env_path)


class OCRService:
    """Servicio de reconocimiento óptico de caracteres usando Azure Document Intelligence."""

    @staticmethod
    async def extract_text(file_bytes: bytes) -> str:
        """Envía el PDF a Azure y devuelve el texto extraído."""
        endpoint = os.getenv("AZURE_OCR_ENDPOINT")
        key = os.getenv("AZURE_OCR_KEY")
        
        if not endpoint or not key:
            raise ValueError("Las credenciales de Azure OCR no están configuradas.")
            
        client = DocumentIntelligenceClient(endpoint=endpoint, credential=AzureKeyCredential(key))
        
        print("Enviando documento a Azure Document Intelligence...")
        
        # Análisis del documento usando el modelo prebuilt-read
        poller = client.begin_analyze_document(
            "prebuilt-read",
            body=file_bytes,
            content_type="application/pdf"
        )
        
        result: AnalyzeResult = poller.result()
        print("Extracción OCR completada.")
        
        return result.content
