"""OCR agent — text extraction from PDFs and images.

Digital PDFs are read with pdfplumber (embedded text layer). Scanned /
image-only PDF pages yield little or no text, so each such page is rendered
with poppler's pdftoppm and run through tesseract. All blocking work runs in
a worker thread so the async event loop stays responsive.
"""

from __future__ import annotations

import asyncio
import subprocess
import tempfile
from io import BytesIO
from pathlib import Path

import pdfplumber
import pytesseract
from PIL import Image

from app.agents.base import BaseAgent
from app.config import get_settings
from app.logging import get_logger

log = get_logger(__name__)

# A digital page usually extracts more than this; below it we assume scanned.
MIN_TEXT_CHARS = 40
# Safety cap so a 900-page scan cannot stall the engine for an hour.
MAX_PDF_PAGES = 60


class OCRAgent(BaseAgent):
    def __init__(self):
        super().__init__(capability="OCR")

    async def run(
        self,
        *,
        blob: bytes,
        filename: str,
        mime_type: str,
        language: str = "eng",
    ) -> dict:
        settings = get_settings()
        pages, text_parts = await asyncio.to_thread(
            _extract_sync, blob, filename, mime_type, language
        )
        return {
            "text": "\n\n".join(text_parts),
            "pages": pages,
            "model": settings.ocr_model,
            "language": language,
        }


def _extract_sync(blob: bytes, filename: str, mime_type: str, language: str) -> tuple[list[dict], list[str]]:
    pages: list[dict] = []
    text_parts: list[str] = []

    is_pdf = mime_type.startswith("application/pdf") or filename.lower().endswith(".pdf")
    if is_pdf:
        pages, text_parts = _extract_pdf(blob, language)
    else:
        page_text = pytesseract.image_to_string(Image.open(BytesIO(blob)), lang=language)
        pages.append({"page_number": 1, "text": page_text, "blocks": []})
        text_parts.append(page_text)

    return pages, text_parts


def _extract_pdf(blob: bytes, language: str) -> tuple[list[dict], list[str]]:
    pages: list[dict] = []
    text_parts: list[str] = []
    truncated = False

    with pdfplumber.open(BytesIO(blob)) as pdf:
        total = len(pdf.pages)
        for idx, page in enumerate(pdf.pages, start=1):
            if idx > MAX_PDF_PAGES:
                truncated = True
                break
            page_text = page.extract_text() or ""
            method = "text-layer"
            if len(page_text.strip()) < MIN_TEXT_CHARS:
                # Scanned page: render it and let tesseract read it.
                rendered = _render_page(blob, idx)
                if rendered is not None:
                    page_text = pytesseract.image_to_string(rendered, lang=language)
                    method = "tesseract"
            pages.append({"page_number": idx, "text": page_text, "blocks": [], "method": method})
            text_parts.append(page_text)

    if truncated:
        log.warning("ocr.pdf_truncated", total_pages=total, processed=MAX_PDF_PAGES)
    return pages, text_parts


def _render_page(pdf_blob: bytes, page_number: int, dpi: int = 200) -> Image.Image | None:
    """Render one PDF page to a PIL image via poppler's pdftoppm."""
    try:
        with tempfile.TemporaryDirectory() as tmp:
            pdf_path = Path(tmp) / "doc.pdf"
            pdf_path.write_bytes(pdf_blob)
            subprocess.run(
                [
                    "pdftoppm", "-f", str(page_number), "-l", str(page_number),
                    "-r", str(dpi), "-png", str(pdf_path), str(Path(tmp) / "page"),
                ],
                check=True,
                capture_output=True,
                timeout=60,
            )
            pngs = sorted(Path(tmp).glob("page-*.png"))
            if not pngs:
                return None
            return Image.open(pngs[0])
    except Exception as exc:
        log.warning("ocr.render_failed", page=page_number, error=str(exc))
        return None
