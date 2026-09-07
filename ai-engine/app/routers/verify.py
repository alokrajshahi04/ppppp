"""Verification endpoint — judge a claim against its citations."""

from fastapi import APIRouter, HTTPException

from app.logging import get_logger
from app.schemas import VerifyRequest, VerifyResponse
from app.verification.verifier import Verifier

router = APIRouter()
log = get_logger(__name__)


@router.post("/verify", response_model=VerifyResponse)
async def verify(req: VerifyRequest) -> VerifyResponse:
    try:
        result = await Verifier().verify(req)
    except Exception as exc:  # pragma: no cover
        log.error("verify.failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"verifier failed: {exc}") from exc

    return VerifyResponse(**result)
