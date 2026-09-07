"""MinIO helpers — fetch raw bytes, presign uploads and downloads."""

from __future__ import annotations

from functools import lru_cache

from minio import Minio

from app.config import get_settings


@lru_cache(maxsize=1)
def _client() -> Minio:
    s = get_settings()
    return Minio(
        s.minio_endpoint,
        access_key=s.minio_root_user,
        secret_key=s.minio_root_password,
        secure=s.minio_secure,
    )


def _bucket() -> str:
    return get_settings().minio_bucket


def get_object_bytes(key: str) -> bytes:
    resp = _client().get_object(_bucket(), key)
    try:
        return resp.read()
    finally:
        resp.close()
        resp.release_conn()


def presigned_upload_url(key: str, expires_seconds: int = 3600) -> str:
    return _client().presigned_put_object(_bucket(), key, expires=expires_seconds)


def presigned_download_url(key: str, expires_seconds: int = 3600) -> str:
    return _client().presigned_get_object(_bucket(), key, expires=expires_seconds)
