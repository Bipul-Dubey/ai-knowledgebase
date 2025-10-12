from fastapi import APIRouter, Request, UploadFile, File, status
import os
import shutil
from uuid import uuid4
from pydantic import BaseModel

from app.database.helpers import get_db_cursor
from app.utils.response import APIResponse
from app.helpers.local_embeddings import (
    BASE_UPLOAD_DIR,
    add_embedding_to_store,
    chunk_text,
    persist_data,
    search_faiss,
)

router = APIRouter(prefix="/documents", tags=["Documents"])


# ======================================================
# Upload Document
# ======================================================
@router.post("/upload")
async def upload_document(request: Request, file: UploadFile = File(...), title: str = None):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims["organization_id"]

    # Create organization folder
    org_folder = os.path.join(BASE_UPLOAD_DIR, str(org_id))
    os.makedirs(org_folder, exist_ok=True)

    ext = os.path.splitext(file.filename)[1]
    title = title or os.path.splitext(file.filename)[0]
    file_name = f"{uuid4()}{ext}"
    file_path = os.path.join(org_folder, file_name)

    # Save file locally
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    async with get_db_cursor() as cur:
        await cur.execute(
            """
            INSERT INTO documents (id, organization_id, title, file_name, file_type, status)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, 'pending')
            RETURNING *
            """,
            (org_id, title, file_name, ext),
        )
        document = await cur.fetchone()

    return APIResponse(False, "Document uploaded successfully", document, status.HTTP_200_OK)


# ======================================================
# Train All Documents (FAISS Embedding)
# ======================================================
@router.post("/train")
async def train_all_documents(request: Request):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims["organization_id"]

    # Fetch all organization documents
    async with get_db_cursor() as cur:
        await cur.execute("SELECT id, file_name FROM documents WHERE organization_id=%s", (org_id,))
        documents = await cur.fetchall()

    if not documents:
        return APIResponse(True, "No documents found", None, status.HTTP_404_NOT_FOUND)

    # Clear previous chunks
    async with get_db_cursor() as cur:
        await cur.execute("DELETE FROM document_chunks WHERE organization_id=%s", (org_id,))

    org_folder = os.path.join(BASE_UPLOAD_DIR, str(org_id))

    for doc in documents:
        file_path = os.path.join(org_folder, doc["file_name"])
        if not os.path.exists(file_path):
            continue

        # Read and chunk document
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        chunks = chunk_text(content)

        # Store each chunk embedding + record
        for i, chunk in enumerate(chunks):
            emb_id = add_embedding_to_store(chunk, doc["id"], org_id)
            async with get_db_cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO document_chunks (id, document_id, organization_id, chunk_index, chunk_text, embedding_id)
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)
                    """,
                    (doc["id"], org_id, i, chunk, emb_id),
                )

    # Update document statuses
    async with get_db_cursor() as cur:
        await cur.execute("UPDATE documents SET status='active' WHERE organization_id=%s", (org_id,))

    persist_data()

    return APIResponse(False, "✅ All documents trained & active", {"total_documents": len(documents)}, status.HTTP_200_OK)


# ======================================================
# Query Endpoint
# ======================================================
class QueryPayload(BaseModel):
    query: str
    top_k: int = 5


@router.post("/query")
async def query_documents(request: Request, payload: QueryPayload):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims["organization_id"]
    results = search_faiss(payload.query, top_k=payload.top_k, organization_id=org_id)

    return APIResponse(False, "Query results", results, status.HTTP_200_OK)
