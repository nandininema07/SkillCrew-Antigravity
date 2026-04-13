"""Extract plain text from PDF files (bytes or path)."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import BinaryIO


def _reader_from_bytes(data: bytes):
    from pypdf import PdfReader

    if not data or len(data) < 5:
        raise ValueError("PDF data is empty or too small")
    return PdfReader(BytesIO(data))


def extract_text_from_pdf_bytes(data: bytes, *, password: str | None = None) -> str:
    """Return all extractable text from PDF bytes, pages joined with newlines."""
    reader = _reader_from_bytes(data)
    if reader.is_encrypted:
        if password is None:
            raise ValueError("PDF is password-protected; pass password=")
        if reader.decrypt(password) == 0:
            raise ValueError("Incorrect PDF password")
    parts: list[str] = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            parts.append(t)
    return "\n\n".join(parts).strip()


def extract_pages_from_pdf_bytes(data: bytes, *, password: str | None = None) -> list[str]:
    """Return one string per page (may be empty strings for image-only pages)."""
    reader = _reader_from_bytes(data)
    if reader.is_encrypted:
        if password is None:
            raise ValueError("PDF is password-protected; pass password=")
        if reader.decrypt(password) == 0:
            raise ValueError("Incorrect PDF password")
    out: list[str] = []
    for page in reader.pages:
        t = page.extract_text()
        out.append((t or "").strip())
    return out


def extract_text_from_pdf_path(path: str | Path, *, password: str | None = None) -> str:
    """Read a PDF from disk and return extracted text."""
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(str(p))
    return extract_text_from_pdf_bytes(p.read_bytes(), password=password)


def extract_text_from_pdf_file(fileobj: BinaryIO, *, password: str | None = None) -> str:
    """Read a PDF from a binary file-like object (e.g. UploadFile.file)."""
    return extract_text_from_pdf_bytes(fileobj.read(), password=password)
