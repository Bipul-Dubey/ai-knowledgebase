import aiofiles
import tempfile
import docx
import textract
from pathlib import Path
from typing import List, Union

from app.helpers.s3_storage import download_file_from_s3


class FileManager:
    """
    Handles downloading, reading, and chunking of DOCUMENTS ONLY.
    Supports files stored in S3 for Base RAG pipelines.
    """

    # ---------------------------
    # 🔹 File download utilities
    # ---------------------------
    @staticmethod
    async def download_to_tempfile(s3_key: str) -> str:
        """
        Download file from S3 and store it in a temporary file.
        """
        content = await download_file_from_s3(s3_key)
        ext = Path(s3_key).suffix or ".bin"

        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        async with aiofiles.open(tmp_file.name, "wb") as f:
            await f.write(content)

        return tmp_file.name

    # ---------------------------
    # 🔹 Text extraction
    # ---------------------------
    @staticmethod
    def extract_text(file_path: str) -> str:
        """
        Extract text from supported document formats.
        """
        ext = Path(file_path).suffix.lower()

        try:
            if ext == ".txt":
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()

            elif ext in [".docx", ".doc"]:
                doc = docx.Document(file_path)
                return "\n".join(p.text for p in doc.paragraphs)

            elif ext in [".pdf", ".xls", ".xlsx"]:
                return textract.process(file_path).decode("utf-8", errors="ignore")

            else:
                raise ValueError(f"Unsupported file type: {ext}")

        except Exception as e:
            raise ValueError(f"Text extraction failed for {file_path}: {e}")

    # ---------------------------
    # 🔹 Chunking
    # ---------------------------
    @staticmethod
    def chunk_text(
        text: str,
        chunk_size: int = 1000,
        overlap: int = 200,
    ) -> List[str]:
        """
        Split text into overlapping chunks.
        """
        if not text:
            return []

        text = " ".join(text.split())
        chunks = []
        start = 0
        length = len(text)

        while start < length:
            end = min(start + chunk_size, length)
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            start += chunk_size - overlap

        return chunks

    # ---------------------------
    # 🔹 Unified Entry Point
    # ---------------------------
    @staticmethod
    async def get_text_from_source(source: Union[str, dict]) -> str:
        """
        Unified entry point — fetch text from:
        - S3 documents only

        Expected source format:
        {
            "s3_key": "...",
            "id": "...",
            "type": "document"
        }
        """
        if isinstance(source, dict) and "s3_key" in source:
            tmp_path = await FileManager.download_to_tempfile(source["s3_key"])
            return FileManager.extract_text(tmp_path)

        raise ValueError("Invalid source format. Expected document with 's3_key'.")
