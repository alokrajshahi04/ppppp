"""FastAPI entrypoint — internal API consumed by the TypeScript backend."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.logging import configure_logging, get_logger
from app.routers import (
    automations,
    code,
    embed,
    evidence,
    ocr,
    reason,
    route,
    verify,
    vision,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    log = get_logger("ai-engine")
    log.info("ai-engine.startup", version="0.1.0")
    yield
    log.info("ai-engine.shutdown")


app = FastAPI(
    title="Tolti AI Engine",
    version="0.1.0",
    description=(
        "Internal API for the Tolti AI sovereign workbench. "
        "Not exposed to the browser — only the TypeScript backend calls this."
    ),
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    settings = get_settings()
    return {
        "status": "ok",
        "version": "0.1.0",
        "embedding_model": settings.embedding_model,
        "text_model": settings.text_model,
        "code_model": settings.code_model,
        "ocr_model": settings.ocr_model,
        "vision_model": settings.vision_model,
    }


# Capability routers
app.include_router(embed.router, prefix="/v1", tags=["embed"])
app.include_router(ocr.router, prefix="/v1", tags=["ocr"])
app.include_router(vision.router, prefix="/v1", tags=["vision"])
app.include_router(reason.router, prefix="/v1", tags=["reason"])
app.include_router(code.router, prefix="/v1", tags=["code"])
app.include_router(route.router, prefix="/v1", tags=["route"])
app.include_router(verify.router, prefix="/v1", tags=["verify"])
app.include_router(evidence.router, prefix="/v1", tags=["evidence"])
app.include_router(automations.router, prefix="/v1", tags=["automations"])
