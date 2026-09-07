"""Shared Pydantic schemas (request / response shapes)."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────
#  Common
# ─────────────────────────────────────────────────────────────

class HealthInfo(BaseModel):
    status: str
    version: str
    embedding_model: str | None = None
    text_model: str | None = None
    code_model: str | None = None
    ocr_model: str | None = None
    vision_model: str | None = None


# ─────────────────────────────────────────────────────────────
#  Embeddings
# ─────────────────────────────────────────────────────────────

class EmbedRequest(BaseModel):
    input: str | list[str]
    model_id: str | None = None


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    model: str
    dimensions: int


# ─────────────────────────────────────────────────────────────
#  OCR
# ─────────────────────────────────────────────────────────────

class OCRBlock(BaseModel):
    text: str
    bbox: tuple[float, float, float, float]
    confidence: float


class OCRPage(BaseModel):
    page_number: int
    text: str
    blocks: list[OCRBlock]


class OCRRequest(BaseModel):
    storage_key: str
    filename: str
    mime_type: str
    language: str | None = "eng"


class OCRResponse(BaseModel):
    text: str
    pages: list[OCRPage]
    model: str
    language: str


# ─────────────────────────────────────────────────────────────
#  Vision
# ─────────────────────────────────────────────────────────────

class VisionFinding(BaseModel):
    label: str
    detail: str
    confidence: float
    bbox: tuple[float, float, float, float] | None = None


class VisionRequest(BaseModel):
    storage_key: str
    filename: str
    mime_type: str
    prompt: str
    context: str | None = None


class VisionResponse(BaseModel):
    description: str
    findings: list[VisionFinding]
    model: str


# ─────────────────────────────────────────────────────────────
#  Reasoning (RAG-augmented)
# ─────────────────────────────────────────────────────────────

class ContextChunk(BaseModel):
    content: str
    evidence_id: UUID
    chunk_id: UUID
    score: float


class ReasoningRequest(BaseModel):
    prompt: str
    system_prompt: str | None = None
    context_chunks: list[ContextChunk] | None = None
    evidence_summary: str | None = None
    model_id: str | None = None
    temperature: float | None = 0.2
    max_tokens: int | None = None
    stream: bool = False


class Citation(BaseModel):
    evidence_id: UUID
    chunk_id: UUID
    quote: str
    confidence: float


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ReasoningResponse(BaseModel):
    answer: str
    citations: list[Citation]
    model: str
    token_usage: TokenUsage | None = None


# ─────────────────────────────────────────────────────────────
#  Code
# ─────────────────────────────────────────────────────────────

class CodeRequest(BaseModel):
    prompt: str
    language: str | None = None
    context: str | None = None
    model_id: str | None = None


class CodeResponse(BaseModel):
    code: str
    explanation: str
    language: str
    model: str


# ─────────────────────────────────────────────────────────────
#  Agent Router
# ─────────────────────────────────────────────────────────────

Capability = Literal["OCR", "VISION", "TEXT", "CODE", "EMBEDDING", "AUTOMATION"]
EvidenceKind = Literal["PDF", "IMAGE", "DIAGRAM", "TEXT", "CODE", "OTHER"]


class RouteRequest(BaseModel):
    task_id: UUID | None = None
    capability: Capability | None = None
    input_kind: EvidenceKind | None = None
    prompt: str
    evidence_ids: list[UUID] | None = None


class RouteDecision(BaseModel):
    capability: Capability
    model_id: str
    reason: str
    confidence: float = Field(ge=0.0, le=1.0)
    params: dict[str, Any] | None = None


# ─────────────────────────────────────────────────────────────
#  Verification
# ─────────────────────────────────────────────────────────────

class VerifyCitation(BaseModel):
    evidence_id: UUID
    chunk_id: UUID
    quote: str


class VerifyRequest(BaseModel):
    claim: str
    citations: list[VerifyCitation]


class VerifyResponse(BaseModel):
    verdict: Literal["SUPPORTED", "PARTIAL", "UNSUPPORTED", "CONTRADICTED"]
    confidence: float
    reasoning: str


# ─────────────────────────────────────────────────────────────
#  Index / retrieve (RAG)
# ─────────────────────────────────────────────────────────────

class IndexEvidenceRequest(BaseModel):
    evidence_id: UUID
    storage_key: str
    filename: str
    mime_type: str
    ocr_text: str | None = None
    kind: EvidenceKind


class IndexEvidenceResponse(BaseModel):
    evidence_id: UUID
    chunks_indexed: int
    dimensions: int


class RetrieveRequest(BaseModel):
    task_id: UUID | None = None
    query: str
    top_k: int | None = 8
    evidence_ids: list[UUID] | None = None


class RetrievedChunk(BaseModel):
    chunk_id: UUID
    evidence_id: UUID
    filename: str
    content: str
    score: float


class RetrieveResponse(BaseModel):
    chunks: list[RetrievedChunk]


# ─────────────────────────────────────────────────────────────
#  Streaming chunk
# ─────────────────────────────────────────────────────────────

class StreamChunk(BaseModel):
    type: Literal["start", "token", "citation", "done", "error"]
    run_id: UUID | None = None
    content: str | None = None
    citation: Citation | None = None
    error: str | None = None
    status: Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"] | None = None
