FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS backend-build
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app/ ./app/
COPY backend/scripts/ ./scripts/
COPY --from=frontend-build /frontend/dist ./estatico
RUN mkdir -p cargas

EXPOSE 8000

CMD uvicorn app.principal:app --host 0.0.0.0 --port ${PORT:-8000}
