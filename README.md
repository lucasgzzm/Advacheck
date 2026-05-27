# WebCheck — Prevalidación Aduanera

Sistema de prevalidación aduanera de facturas de importación. Permite cargar PDFs, extraer texto mediante OCR (Azure AI Document Intelligence), estructurar datos con IA (Google Gemini) y realizar validación cruzada entre documentos.

## Stack

- **Frontend:** React 19 + Vite
- **Backend:** FastAPI (Python)
- **Base de datos:** PostgreSQL
- **OCR:** Azure AI Document Intelligence
- **IA:** Google Gemini API

## Inicio rápido (desarrollo local)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env   # Completar con tus claves
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Deploy en Render

Este proyecto está configurado para deploy en [Render](https://render.com) mediante `render.yaml`.

### Requisitos

1. Cuenta en [Render](https://render.com) (el plan free alcanza para empezar)
2. Repositorio en GitHub/GitLab conectado a Render
3. Claves de API: Azure AI Document Intelligence y Google Gemini

### Pasos (Blueprint)

1. Ir a [Render Dashboard → Blueprint](https://dashboard.render.com/blueprints)
2. Conectar tu repositorio de GitHub
3. Render detectará automáticamente el `render.yaml`
4. Configurar las variables de entorno secretas:
   - `AZURE_OCR_ENDPOINT`
   - `AZURE_OCR_KEY`
   - `GEMINI_API_KEY`
   - `OPENAI_API_KEY` (opcional)
5. Hacer clic en "Apply"

Render creará:
- Una base de datos PostgreSQL (`webcheck-db`)
- El backend como Web Service (`webcheck-backend`)
- El frontend como Static Site (`webcheck-frontend`)

### Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | ✅ (generada por Render) | URL de conexión a PostgreSQL |
| `SECRET_KEY` | ✅ (generada por Render) | Clave para firmar JWT |
| `AZURE_OCR_ENDPOINT` | ✅ | Endpoint de Azure AI Document Intelligence |
| `AZURE_OCR_KEY` | ✅ | Clave de Azure AI Document Intelligence |
| `GEMINI_API_KEY` | ✅ | Clave de Google Gemini API |
| `CORS_ORIGINS` | ✅ | Orígenes permitidos (separados por coma) |
| `OPENAI_API_KEY` | ❌ | Clave de OpenAI (opcional, como respaldo OCR) |

## Deploy manual con Docker

```bash
docker build -t webcheck .
docker run -p 8000:8000 \
  -e DATABASE_URL=postgresql+asyncpg://... \
  -e SECRET_KEY=... \
  -e AZURE_OCR_ENDPOINT=... \
  -e AZURE_OCR_KEY=... \
  -e GEMINI_API_KEY=... \
  webcheck
```
