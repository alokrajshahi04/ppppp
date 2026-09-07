"""Index + retrieve endpoints — the RAG pipeline."""

from fastapi import APIRouter, HTTPException

from app.logging import get_logger
from app.rag.indexer import Indexer
from app.rag.retriever import Retriever
from app.schemas import (
    IndexEvidenceRequest,
    IndexEvidenceResponse,
    RetrieveRequest,
    RetrieveResponse,
)

router = APIRouter()
log = get_logger(__name__)


@router.post("/index/evidence", response_model=IndexEvidenceResponse)
async def index_evidence(req: IndexEvidenceRequest) -> IndexEvidenceResponse:
    try:
        result = await Indexer().index(req)
    except Exception as exc:  # pragma: no cover
        log.error("index.failed", evidence_id=str(req.evidence_id), error=str(exc))
        raise HTTPException(status_code=502, detail=f"indexer failed: {exc}") from exc
    return IndexEvidenceResponse(**result)


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(req: RetrieveRequest) -> RetrieveResponse:
    try:
        result = await Retriever().retrieve(req)
    except Exception as exc:  # pragma: no cover
        log.error("retrieve.failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"retriever failed: {exc}") from exc
    return RetrieveResponse(**result)
