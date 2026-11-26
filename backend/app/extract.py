from io import BytesIO

from fastapi import HTTPException

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_EXTRACTED_CHARS = 120_000


def extract_resume_bytes(filename: str, content: bytes) -> dict:
    """Extract selectable text from a PDF or DOCX resume buffer."""
    clean_name = (filename or "").strip()
    extension = clean_name.lower().rsplit(".", 1)[-1] if "." in clean_name else ""
    if extension not in {"pdf", "docx"}:
        raise HTTPException(415, "Upload a PDF or DOCX file")

    if not content:
        raise HTTPException(400, "The uploaded file is empty")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, "Resume file exceeds the 10 MB limit")

    try:
        if extension == "pdf":
            from pypdf import PdfReader

            reader = PdfReader(BytesIO(content))
            if reader.is_encrypted:
                raise HTTPException(422, "Password-protected PDFs are not supported")
            pages = reader.pages
            text = "\n".join((page.extract_text() or "") for page in pages)
            page_count = len(pages)
        else:
            from docx import Document

            document = Document(BytesIO(content))
            paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
            table_text = [
                " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                for table in document.tables
                for row in table.rows
            ]
            text = "\n".join(paragraphs + [line for line in table_text if line])
            page_count = None
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            422,
            "The file could not be read. Check that it is a valid, uncorrupted PDF or DOCX.",
        )

    text = text.strip()
    if not text:
        raise HTTPException(
            422,
            "No selectable text was found. Scanned/image-only PDFs require OCR, which is not enabled.",
        )

    return {
        "filename": clean_name,
        "text": text[:MAX_EXTRACTED_CHARS],
        "characters": min(len(text), MAX_EXTRACTED_CHARS),
        "pages": page_count,
        "truncated": len(text) > MAX_EXTRACTED_CHARS,
    }
