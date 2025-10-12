import os
import shutil
from uuid import uuid4
from fastapi import UploadFile, HTTPException, status
import pandas as pd
from PyPDF2 import PdfReader
from docx import Document

# ================================
# Settings
# ================================
BASE_UPLOAD_DIR = os.path.join(os.getcwd(), "local_data", "documents")
os.makedirs(BASE_UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx", ".xls", ".xlsx"}

# ================================
# File Saving & Extraction
# ================================
def save_file_locally(file: UploadFile, org_id: str, title: str = None) -> dict:
    """
    Save uploaded file to organization folder, validate extension, return metadata.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    org_folder = os.path.join(BASE_UPLOAD_DIR, str(org_id))
    os.makedirs(org_folder, exist_ok=True)

    file_name = f"{uuid4()}{ext}"
    file_path = os.path.join(org_folder, file_name)
    title = title or os.path.splitext(file.filename)[0]

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {
        "file_path": file_path,
        "file_name": file_name,
        "title": title,
        "extension": ext
    }


def extract_text_from_file(file_path: str) -> str:
    """
    Extract plain text from supported files (.txt, .pdf, .docx, .xls, .xlsx)
    """
    ext = os.path.splitext(file_path)[1].lower()
    try:
        if ext == ".txt":
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()

        elif ext == ".pdf":
            reader = PdfReader(file_path)
            return "\n".join([p.extract_text() or "" for p in reader.pages])

        elif ext == ".docx":
            doc = Document(file_path)
            return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])

        elif ext in {".xls", ".xlsx"}:
            dfs = pd.read_excel(file_path, sheet_name=None)
            all_text = []
            for sheet_name, df in dfs.items():
                text = df.to_string(index=False)
                all_text.append(f"Sheet: {sheet_name}\n{text}")
            return "\n\n".join(all_text)

        else:
            raise ValueError(f"Unsupported file type: {ext}")

    except Exception as e:
        raise RuntimeError(f"Failed to extract text from {file_path}: {str(e)}")


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """
    Splits a long text into chunks for embeddings.

    Args:
        text (str): The input text.
        chunk_size (int): Approximate number of words per chunk.
        overlap (int): Number of overlapping words between chunks.

    Returns:
        List[str]: List of text chunks.
    """
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks
