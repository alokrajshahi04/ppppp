"""Postgres session helpers (pgvector-aware)."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings


_ENGINE: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def _get_engine() -> Engine:
    global _ENGINE
    if _ENGINE is None:
        s = get_settings()
        # SQLAlchemy needs the driver-qualified DSN; psycopg (v3) is installed.
        url = s.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        _ENGINE = create_engine(url, pool_pre_ping=True, future=True)
    return _ENGINE


def get_db_session() -> Session:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=_get_engine(), autoflush=False, autocommit=False)
    return _SessionLocal()


@contextmanager
def session_scope() -> Iterator[Session]:
    s = get_db_session()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()


def ping() -> bool:
    try:
        with session_scope() as s:
            s.execute(text("SELECT 1"))
        return True
    except Exception:  # pragma: no cover
        return False
