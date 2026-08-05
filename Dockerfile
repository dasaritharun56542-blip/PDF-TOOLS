# Production-ready Dockerfile for PDF POWERHOUSE Django Application
FROM python:3.12-slim-bookworm

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8000

# Create non-root application user
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -m -s /bin/bash appuser

# Set working directory
WORKDIR /app

# Install required Linux system packages
# Only install packages genuinely required by the application tools:
# - build-essential, gcc, libpq-dev: C compilation & PostgreSQL drivers
# - libgl1, libglib2.0-0, libgomp1: OpenCV & PaddleOCR headless execution support
# - tesseract-ocr, tesseract-ocr-eng: System OCR engine for pytesseract
# - poppler-utils: PDF rendering utilities
# - fonts-dejavu-core, fontconfig: DejaVuSans font required by ReportLab unicode generator
# - curl: System utility and container health check capability
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

# Copy python dependencies file
COPY requirements.txt /app/

# Install python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy Django project files
COPY . /app/

# Create required temporary and storage directories with ownership for appuser
RUN mkdir -p /app/media/uploaded \
    /app/media/processed \
    /app/media/invoices \
    /app/scratch \
    /home/appuser/.secure_admin_storage/uploaded \
    /home/appuser/.secure_admin_storage/processed \
    /home/appuser/.secure_admin_storage/invoices \
    && chown -R appuser:appuser /app /home/appuser

# Switch to non-root application user
USER appuser

# Expose web service port
EXPOSE 8000

# Default web command using Gunicorn
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
