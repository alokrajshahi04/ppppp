# ─────────────────────────────────────────────────────────────
#  Tolti AI · AI Engine (Python / FastAPI)
#  Internal API: agent router, OCR, vision, RAG, verification.
# ─────────────────────────────────────────────────────────────

FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps for OCR, PDF parsing, image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        poppler-utils \
        libmagic1 \
        libgl1 \
        libglib2.0-0 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── deps ─────────────────────────────────────────────────────
FROM base AS deps
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

# ── runtime ──────────────────────────────────────────────────
FROM base AS runtime
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY . .
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD curl -fsS http://localhost:8000/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
