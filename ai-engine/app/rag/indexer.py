"""Indexer — chunk + embed + persist into pgvector."""

from __future__ import annotations

from sqlalchemy import text

from app.logging import get_logger
from app.models.providers import get_provider
from app.rag.chunker import chunk_text
from app.schemas import IndexEvidenceRequest
from app.storage.db import session_scope
from app.storage.minio_client import get_object_bytes

log = get_logger(__name__)


class Indexer:
    async def index(self, req: IndexEvidenceRequest) -> dict:
        provider = get_provider()

        # Pull text. Prefer pre-computed OCR text; otherwise pull + OCR on the fly.
        text_content = req.ocr_text
        if not text_content:
            try:
                blob = get_object_bytes(req.storage_key)
                if req.mime_type.startswith("application/pdf"):
                    import pdfplumber
                    from io import BytesIO
                    with pdfplumber.open(BytesIO(blob)) as pdf:
                        text_content = "\n\n".join((p.extract_text() or "") for p in pdf.pages)
                else:
                    import pytesseract
                    from PIL import Image
                    from io import BytesIO
                    text_content = pytesseract.image_to_string(Image.open(BytesIO(blob)))
            except Exception as exc:
                log.warning("index.no_text", error=str(exc))
                text_content = ""

        if not text_content:
            return {"evidence_id": str(req.evidence_id), "chunks_indexed": 0, "dimensions": 0}

        chunks = chunk_text(text_content)
        if not chunks:
            return {"evidence_id": str(req.evidence_id), "chunks_indexed": 0, "dimensions": 0}

        # Embed in batches — CPU embedding servers (Ollama) process sequentially
        # and a single huge request would blow the client timeout.
        BATCH = 16
        vectors: list[list[float]] = []
        for i in range(0, len(chunks), BATCH):
            batch = chunks[i : i + BATCH]
            vectors.extend(await provider.embed(inputs=batch))
            log.info("index.batch", done=min(i + BATCH, len(chunks)), total=len(chunks))

        with session_scope() as s:
            # Wipe any prior chunks for this evidence (re-index is idempotent).
            s.execute(
                text("DELETE FROM evidence_chunks WHERE evidence_id = :eid"),
                {"eid": str(req.evidence_id)},
            )
            for idx, (chunk, vec) in enumerate(zip(chunks, vectors)):
                s.execute(
                    text(
                        "INSERT INTO evidence_chunks "
                        "(evidence_id, chunk_index, content, embedding) "
                        "VALUES (:eid, :idx, :content, :vec)"
                    ),
                    {
                        "eid": str(req.evidence_id),
                        "idx": idx,
                        "content": chunk,
                        "vec": vec,
                    },
                )

        return {
            "evidence_id": str(req.evidence_id),
            "chunks_indexed": len(chunks),
            "dimensions": len(vectors[0]) if vectors else 0,
        }
