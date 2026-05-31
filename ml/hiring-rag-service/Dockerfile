FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=120 --retries=10 \
    --extra-index-url https://download.pytorch.org/whl/cpu "torch==2.5.1+cpu"
RUN pip install --no-cache-dir --default-timeout=120 --retries=10 -r requirements.txt

COPY app ./app

RUN mkdir -p /app/data/storage /app/chroma_db /tmp/huggingface

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/tmp/huggingface \
    TRANSFORMERS_CACHE=/tmp/huggingface \
    RESUME_STORAGE_ROOT=/app/data/storage \
    CHROMA_DB_PATH=/app/chroma_db \
    SERVICE_PORT=8090

EXPOSE 8090

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
