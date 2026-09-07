"""Retrieve endpoint — alias router used in the OpenAPI doc."""

from fastapi import APIRouter, HTTPException

from app.logging import get_logger
from app.rag.retriever import Retriever
from app.schemas import RetrieveRequest, RetrieveResponse

router = APIRouter()
log = get_logger(__name__)


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(req: RetrieveRequest) -> RetrieveResponse:
    try:
        result = await Retriever().retrieve(req)
    except Exception as exc:  # pragma: no cover
        log.error("retrieve.failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"retriever failed: {exc}") from exc
    return RetrieveResponse(**result)
