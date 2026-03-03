# ─────────────────────────────────────────────────────────
# SAIOMS ML Service — Optimized for HuggingFace Spaces
# Uses slim Python base to keep image under 5GB HF limit
# ─────────────────────────────────────────────────────────
FROM python:3.11-slim

# System deps for Pillow, torch
RUN apt-get update && apt-get install -y \
    libglib2.0-0 libsm6 libxrender1 libxext6 \
    curl git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer caching)
COPY requirements.txt .

# Install torch CPU-only (much smaller than default GPU build)
RUN pip install --no-cache-dir torch==2.3.0 torchvision==0.18.0 \
    --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Create static dir
RUN mkdir -p static/qrcodes static/avatars

# HuggingFace Spaces runs as non-root user 1000
RUN chown -R 1000:1000 /app
USER 1000

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
