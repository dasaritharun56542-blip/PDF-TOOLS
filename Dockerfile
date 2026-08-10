# ============================================================================
# Stage 1: Build React Vite Frontend SPA
# ============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /build
COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .
RUN npm run build

# ============================================================================
# Stage 2: Production Django + PyMuPDF Backend Engine
# ============================================================================
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8000

# Create non-root application user
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -m -s /bin/bash appuser

WORKDIR /app

# Install required Linux system packages for PDF & OCR processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    fonts-dejavu-core \
    fontconfig \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy Django codebase
COPY . /app/

# Copy compiled frontend from Stage 1 into /app/dist
COPY --from=frontend-builder /build/dist /app/dist

# Collect static assets into staticfiles
RUN python manage.py collectstatic --noinput || true

# Create required directories with ownership for appuser
RUN mkdir -p /app/media/uploaded \
    /app/media/processed \
    /app/media/invoices \
    /app/scratch \
    /home/appuser/.secure_admin_storage/uploaded \
    /home/appuser/.secure_admin_storage/processed \
    /home/appuser/.secure_admin_storage/invoices \
    && chown -R appuser:appuser /app /home/appuser

USER appuser

EXPOSE 7860

CMD ["sh", "-c", "gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-7860} --workers 3 --timeout 120"]
