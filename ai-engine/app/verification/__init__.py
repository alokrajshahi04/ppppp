"""Verification — citation extraction + claim support checks."""

from app.verification.citations import extract_citations
from app.verification.verifier import Verifier

__all__ = ["Verifier", "extract_citations"]
