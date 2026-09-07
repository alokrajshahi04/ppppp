"""OCR endpoint — pulls file from MinIO, runs the OCR agent, returns structured text."""

from fastapi import APIRouter, HTTPException

from app.agents.ocr_agent import OCRAgent
from app.logging import get_logger
from app.schemas import OCRRequest, OCRResponse
from app.storage.minio_client import get_object_bytes

router = APIRouter()
log = get_logger(__name__)


@router.post("/ocr", response_model=OCRResponse)
async def ocr(req: OCRRequest) -> OCRResponse:
    try:
        blob = get_object_bytes(req.storage_key)
    except Exception as exc:
        log.error("ocr.fetch_failed", key=req.storage_key, error=str(exc))
        raise HTTPException(status_code=404, detail=f"could not fetch object: {exc}") from exc

    agent = OCRAgent()
    try:
        result = await agent.run(
            blob=blob,
            filename=req.filename,
            mime_type=req.mime_type,
            language=req.language or "eng",
        )
    except Exception as exc:  # pragma: no cover
        log.error("ocr.failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"OCR agent failed: {exc}") from exc

    return OCRResponse(**result)
