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

    # ── Per-capability defaults (used when DB has no row) ─────
    ocr_model: str = "llama3.2-vision"
    vision_model: str = "llama3.2-vision"
    text_model: str = "llama3.1:8b"
    code_model: str = "qwen2.5-coder:7b"
    embedding_model: str = "nomic-embed-text"
    embedding_dimensions: int = 768

    # ── RAG ───────────────────────────────────────────────────
    chunk_size: int = 800
    chunk_overlap: int = 120
    retrieval_top_k: int = 8

    # ── Timeouts ──────────────────────────────────────────────
    request_timeout_seconds: float = 120.0


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
