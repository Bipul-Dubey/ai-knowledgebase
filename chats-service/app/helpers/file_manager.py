import aiofiles
import tempfile
from app.helpers.s3_storage import download_file_from_s3
from typing import List
from pathlib import Path
import docx
import textract

class FileManager:
    @staticmethod
    async def download_to_tempfile(s3_key: str) -> str:
        """
        Download S3 file to a temporary local file and return the path
        """
        content = await download_file_from_s3(s3_key)
        print("content", content[:100])

        # Preserve file extension for later extraction
        ext = Path(s3_key).suffix or ".bin"
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)

        async with aiofiles.open(tmp_file.name, "wb") as f:
            await f.write(content)

        return tmp_file.name


    @staticmethod
    def extract_text(file_path: str) -> str:
        """
        Extract text from PDF, DOCX, TXT, Excel etc.
        """
        ext = Path(file_path).suffix.lower()
        if ext in [".txt"]:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        elif ext in [".doc", ".docx"]:
            doc = docx.Document(file_path)
            return "\n".join([p.text for p in doc.paragraphs])
        elif ext in [".pdf", ".xls", ".xlsx"]:
            # textract auto-detects and extracts text
            return textract.process(file_path).decode("utf-8")
        else:
            raise ValueError(f"Unsupported file type: {ext}")

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 1000) -> List[str]:
        """
        Break text into chunks for embeddings
        """
        chunks = []
        for i in range(0, len(text), chunk_size):
            chunks.append(text[i:i + chunk_size])
        return chunks
