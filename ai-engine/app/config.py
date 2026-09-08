"""Settings — every value comes from env vars (see .env.example)."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Server ─────────────────────────────────────────────────
    ai_engine_host: str = "0.0.0.0"
    ai_engine_port: int = 8000
    log_level: str = "INFO"

    # ── Database (Postgres + pgvector) ────────────────────────
    database_url: str = Field(
        default="postgresql://tolti:tolti@localhost:5432/tolti",
        description="PostgreSQL DSN",
    )

    # ── Object storage (MinIO) ────────────────────────────────
    minio_endpoint: str = "localhost:9000"
    minio_root_user: str = "tolti"
    minio_root_password: str = "tolti"
    minio_bucket: str = "evidence"
    minio_secure: bool = False

    # ── Default model endpoint (overridable per-request) ──────
    model_default_base_url: str = "http://localhost:11434/v1"
    model_default_api_key: str = "ollama"

    # ── Per-capability endpoints (empty → falls back to default) ──
    model_code_base_url: str = ""
    model_code_api_key: str = ""
    model_text_base_url: str = ""
    model_text_api_key: str = ""
    model_vision_base_url: str = ""
    model_vision_api_key: str = ""

    # ── Per-capability defaults (used when DB has no row) ─────
    ocr_model: str = "Qwen/Qwen2.5-VL-7B-Instruct"
    vision_model: str = "Qwen/Qwen2.5-VL-7B-Instruct"
    text_model: str = "Qwen/Qwen3-8B"
    code_model: str = "Qwen/Qwen2.5-Coder-7B-Instruct"
    embedding_model: str = "nomic-embed-text"
    embedding_dimensions: int = 768

    # ── RAG ───────────────────────────────────────────────────
    chunk_size: int = 800
    chunk_overlap: int = 120
    retrieval_top_k: int = 8

    # ── Timeouts (Modal cold starts need minutes, not seconds) ──
    request_timeout_seconds: float = 600.0

    # ── SMTP (optional — enables the email automation) ────────
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
