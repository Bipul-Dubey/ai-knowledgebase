import aiofiles
import tempfile
import requests
import docx
import textract
from pathlib import Path
from typing import List, Union
from bs4 import BeautifulSoup
from app.helpers.s3_storage import download_file_from_s3


class FileManager:
    """
    Handles downloading, reading, and chunking of documents and URLs.
    Supports S3, local, and web-based documents for RAG pipelines.
    """

    # ---------------------------
    # 🔹 File download utilities
    # ---------------------------
    @staticmethod
    async def download_to_tempfile(s3_key: str) -> str:
        """
        Download S3 file to a temporary local file and return the path.
        """
        content = await download_file_from_s3(s3_key)
        ext = Path(s3_key).suffix or ".bin"

        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        async with aiofiles.open(tmp_file.name, "wb") as f:
            await f.write(content)

        return tmp_file.name

    @staticmethod
    def download_url_to_tempfile(url: str) -> str:
        """
        Download content from a URL into a temporary file.
        """
        try:
            response = requests.get(url, timeout=20)
            response.raise_for_status()
        except Exception as e:
            raise ValueError(f"Failed to download from URL: {url} ({e})")

        content_type = response.headers.get("Content-Type", "")
        ext = FileManager._guess_extension_from_content_type(content_type, url)

        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        with open(tmp_file.name, "wb") as f:
            f.write(response.content)
        return tmp_file.name

    @staticmethod
    def _guess_extension_from_content_type(content_type: str, url: str) -> str:
        if "pdf" in content_type or url.endswith(".pdf"):
            return ".pdf"
        elif "word" in content_type or url.endswith(".docx"):
            return ".docx"
        elif "html" in content_type or url.endswith(".html"):
            return ".html"
        elif "excel" in content_type or url.endswith(".xlsx"):
            return ".xlsx"
        elif "text" in content_type or url.endswith(".txt"):
            return ".txt"
        else:
            return ".bin"

    # ---------------------------
    # 🔹 Text extraction
    # ---------------------------
    @staticmethod
    def extract_text(file_path: str) -> str:
        ext = Path(file_path).suffix.lower()

        try:
            if ext == ".txt":
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()

            elif ext in [".docx"]:
                doc = docx.Document(file_path)
                return "\n".join([p.text for p in doc.paragraphs])

            elif ext in [".pdf", ".xls", ".xlsx"]:
                return textract.process(file_path).decode("utf-8")

            elif ext in [".html", ".htm"]:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    html = f.read()
                soup = BeautifulSoup(html, "html.parser")
                return soup.get_text(separator="\n", strip=True)

            else:
                raise ValueError(f"Unsupported file type: {ext}")

        except Exception as e:
            raise ValueError(f"Text extraction failed for {file_path}: {e}")

    # ---------------------------
    # 🔹 Chunking
    # ---------------------------
    @staticmethod
    def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        if not text:
            return []

        text = text.replace("\n", " ").replace("\r", " ")
        chunks = []
        start = 0
        text_length = len(text)

        while start < text_length:
            end = min(start + chunk_size, text_length)
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
        Unified entry point — fetch text from either:
        - S3 key (for uploaded documents)
        - URL (for web sources)
        """
        if isinstance(source, dict) and "s3_key" in source:
            tmp_path = await FileManager.download_to_tempfile(source["s3_key"])
            return FileManager.extract_text(tmp_path)

        elif isinstance(source, dict) and "url" in source:
            tmp_path = FileManager.download_url_to_tempfile(source["url"])
            return FileManager.extract_text(tmp_path)

        else:
            raise ValueError("Invalid source format. Must contain 's3_key' or 'url'.")
