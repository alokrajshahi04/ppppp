"""OCR agent — text extraction from PDFs and images."""

from __future__ import annotations

from io import BytesIO

from PIL import Image
import pdfplumber
import pytesseract

from app.agents.base import BaseAgent
from app.config import get_settings


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
        pages: list[dict] = []
        text_parts: list[str] = []

        if mime_type.startswith("application/pdf") or filename.lower().endswith(".pdf"):
            with pdfplumber.open(BytesIO(blob)) as pdf:
                for idx, page in enumerate(pdf.pages, start=1):
                    page_text = page.extract_text() or ""
                    pages.append({
                        "page_number": idx,
                        "text": page_text,
                        "blocks": [],
                    })
                    text_parts.append(page_text)
        else:
            image = Image.open(BytesIO(blob))
            page_text = pytesseract.image_to_string(image, lang=language)
            pages.append({
                "page_number": 1,
                "text": page_text,
                "blocks": [],
            })
            text_parts.append(page_text)

        return {
            "text": "\n\n".join(text_parts),
            "pages": pages,
            "model": settings.ocr_model,
            "language": language,
        }
