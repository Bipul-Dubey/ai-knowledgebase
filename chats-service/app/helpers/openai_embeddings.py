import asyncio
from uuid import uuid4
from app.helpers.file_manager import extract_text_from_file, chunk_text
from app.core.config import settings
import openai
from openai import OpenAI


openai.api_key = settings.OPENAI_API_KEY

client = OpenAI()

async def get_openai_embedding(text: str) -> list[float]:
    text = text[:8191]
    resp = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return resp.data[0].embedding

async def process_document(file_path: str, document_id: str, org_id: str, db_cursor):
    """
    Extract text, chunk it, generate embeddings, and save to PostgreSQL in one transaction.
    """
    content = extract_text_from_file(file_path)
    if not content.strip():
        print(f"[WARN] Empty content in {file_path}, skipping")
        return 0

    chunks = chunk_text(content)
    total_chunks = len(chunks)
    insert_rows = []

    # Generate embeddings asynchronously
    tasks = [get_openai_embedding(chunk) for chunk in chunks]
    embeddings = await asyncio.gather(*tasks)

    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        insert_rows.append((str(uuid4()), document_id, org_id, i, chunk, embedding))

    # Insert all chunks in one transaction
    try:
        await db_cursor.execute("BEGIN;")
        args_str = ",".join(
            db_cursor.mogrify(
                "(%s, %s, %s, %s, %s, %s)", row
            ).decode("utf-8")
            for row in insert_rows
        )
        query = f"""
            INSERT INTO document_chunks (id, document_id, organization_id, chunk_index, chunk_text, embedding)
            VALUES {args_str};
        """
        await db_cursor.execute(query)
        await db_cursor.execute("COMMIT;")
    except Exception as e:
        await db_cursor.execute("ROLLBACK;")
        print(f"[ERROR] Failed to insert document {document_id}: {e}")
        raise

    return total_chunks
