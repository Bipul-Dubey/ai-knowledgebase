import logging
from fastapi import APIRouter, Request, UploadFile, File, status, HTTPException, Query
from fastapi.responses import FileResponse
from app.utils.response import APIResponse
from app.database.postgres_client import get_db_cursor
from app.helpers import storage
from app.helpers.train_document import run_training_job
from pydantic import BaseModel
from typing import List, Optional
from hashlib import sha256

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])

# =======================
# 📄 1️⃣ Upload Document
# =======================
@router.post("/upload")
async def upload_document(request: Request, file: UploadFile = File(...)):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")
    user_id = claims.get("user_id")

    allowed_types = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]

    if file.content_type not in allowed_types:
        return APIResponse(
            True,
            f"File type '{file.content_type}' not allowed",
            None,
            status.HTTP_400_BAD_REQUEST,
        )

    try:
        file_bytes = await file.read()
        file_size = len(file_bytes)
        # Lets training skip a document whose bytes have not changed.
        content_hash = sha256(file_bytes).hexdigest()

        s3_key, presigned_url, expires_at = storage.upload_file(
            file_bytes=file_bytes,
            org_id=org_id,
            filename=file.filename,
            content_type=file.content_type,
        )

        async with get_db_cursor(commit=True) as cur:
            await cur.execute(
                """
                INSERT INTO documents
                    (created_by, organization_id, file_name, s3_key,
                    file_size, content_hash, status, trainable,
                    created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, 'untrained', TRUE, NOW(), NOW())
                RETURNING id, file_name, file_size, created_at
                """,
                (user_id, org_id, file.filename, s3_key, file_size, content_hash),
            )
            document = await cur.fetchone()

        return APIResponse(False, "Document uploaded successfully", document)

    except Exception as e:
        logger.error(f"[UPLOAD ERROR] {e}")
        return APIResponse(
            True,
            f"Failed to upload document: {str(e)}",
            None,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

# =======================
# 📥 2️⃣ Download Document
# =======================
@router.get("/download/{document_id}")
async def download_document(document_id: str, request: Request):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")

    try:
        async with get_db_cursor() as cur:
            await cur.execute(
                """
                SELECT s3_key
                FROM documents
                WHERE id=%s AND organization_id=%s AND deleted_at IS NULL
                """,
                (document_id, org_id),
            )
            doc = await cur.fetchone()

        if not doc:
            return APIResponse(True, "Document not found", None, status.HTTP_404_NOT_FOUND)

        presigned_url, expires_at = storage.get_file_url(
            doc["s3_key"], return_expiry=True
        )

        return APIResponse(
            False,
            "Document URL generated",
            {"url": presigned_url, "expires_at": expires_at},
        )

    except Exception as e:
        logger.error(f"[DOWNLOAD ERROR] {e}")
        return APIResponse(
            True,
            "Failed to generate download URL",
            {"error": str(e)},
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

# ==========================================================
# 📂 Serve a locally-stored document  (ENV=development only)
# ==========================================================
# Stands in for an S3 presigned URL: authority is the HMAC signature over key
# and expiry, not a JWT, because a tab navigation sends no Authorization header.
@router.get("/local/{key:path}")
async def serve_local_document(key: str, exp: int, sig: str):
    if not storage.is_local():
        # Nothing is served from disk outside development.
        raise HTTPException(status_code=404, detail="Not found")

    try:
        storage.verify_local_url(key, exp, sig)
        path = storage.local_path(key)
    except storage.StorageError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    if not path.is_file():
        raise HTTPException(status_code=404, detail="Document not found")

    return FileResponse(
        path,
        media_type=storage.guess_media_type(key),
        filename=storage.original_filename(key),
    )


# =======================
# 🧠 3️⃣ Train Documents
# =======================

class TrainRequest(BaseModel):
    document_ids: Optional[List[str]] = None
    # Re-embed even when the content and indexing settings are unchanged.
    force: bool = False


@router.post("/train")
async def train_documents_endpoint(request: Request, body: TrainRequest):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(
            True, "Unauthorized", None,
            status.HTTP_401_UNAUTHORIZED
        )

    org_id = claims.get("organization_id")
    user_id = claims.get("user_id")
    document_ids = body.document_ids or []

    try:
        async with get_db_cursor(commit=True) as cur:

            # 1️⃣ If no document_ids passed → fetch all trainable documents
            if not document_ids:
                await cur.execute(
                    """
                    SELECT id
                    FROM documents
                    WHERE organization_id=%s
                      AND trainable=TRUE
                      AND deleted_at IS NULL
                      AND status IN ('untrained','trained','failed')
                    """,
                    (org_id,),
                )
                rows = await cur.fetchall()
                document_ids = [r["id"] for r in rows]

            if not document_ids:
                return APIResponse(
                    True,
                    "No trainable documents found",
                    None,
                    status.HTTP_400_BAD_REQUEST,
                )

            # 2️⃣ Update status → training
            #    Also reset last_trained_at
            await cur.execute(
                """
                UPDATE documents
                SET status='training',
                    updated_at=NOW()
                WHERE organization_id=%s
                  AND id = ANY(%s)
                  AND deleted_at IS NULL
                  AND status IN ('untrained','trained','failed')
                RETURNING id
                """,
                (org_id, document_ids),
            )

            updated_docs = await cur.fetchall()
            updated_ids = [r["id"] for r in updated_docs]

            if not updated_ids:
                return APIResponse(
                    True,
                    "No eligible documents to train",
                    None,
                    status.HTTP_400_BAD_REQUEST,
                )

            # 3️⃣ Create training job
            await cur.execute(
                """
                INSERT INTO training_jobs
                    (organization_id, initiated_by, status, created_at)
                VALUES (%s, %s, 'pending', NOW())
                RETURNING id
                """,
                (org_id, user_id),
            )
            job = await cur.fetchone()

        # 4️⃣ Trigger async worker
        run_training_job.delay(
            job["id"], org_id, user_id, updated_ids, body.force
        )

        return APIResponse(
            False,
            "Training job queued successfully",
            {
                "job_id": job["id"],
                "total_documents": len(updated_ids),
            },
            status.HTTP_202_ACCEPTED,
        )

    except Exception as e:
        logger.error(f"[TRAIN ERROR] {e}")
        return APIResponse(
            True,
            "Failed to create training job",
            {"error": str(e)},
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

# =======================
# 📚 4️⃣ List Documents
# =======================
@router.get("/resources")
async def list_documents(
    request: Request,
    status_filter: Optional[str] = Query(None),
    limit: int = 50,
    offset: int = 0,
):
    claims = getattr(request.state, "claims", None)
    if not claims:
        raise HTTPException(status_code=401, detail="Unauthorized")

    org_id = claims.get("organization_id")

    async with get_db_cursor() as cur:
        query = """
            SELECT id, file_name, status, created_at, file_size
            FROM documents
            WHERE organization_id = %s
              AND deleted_at IS NULL
        """
        params = [org_id]

        if status_filter:
            query += " AND status = %s"
            params.append(status_filter)

        query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        await cur.execute(query, tuple(params))
        documents = await cur.fetchall()

    return APIResponse(False, "Documents fetched successfully", documents)

# =======================
# ⚙️ 5️⃣ Set Trainable (Bulk)
# =======================
class TrainableItem(BaseModel):
    id: str
    trainable: bool

class TrainableUpdateBulkRequest(BaseModel):
    items: List[TrainableItem]

@router.patch("/set-trainable-bulk")
async def set_trainable_bulk(request: Request, body: TrainableUpdateBulkRequest):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")
    updated_ids = []

    try:
        async with get_db_cursor(commit=True) as cur:
            for item in body.items:
                await cur.execute(
                    """
                    UPDATE documents
                    SET trainable=%s, updated_at=NOW()
                    WHERE organization_id=%s AND id=%s
                    """,
                    (item.trainable, org_id, item.id),
                )
                updated_ids.append(item.id)

        return APIResponse(
            False,
            "Trainable flags updated successfully",
            {"updated_ids": updated_ids},
        )

    except Exception as e:
        logger.error(f"[TRAINABLE ERROR] {e}")
        return APIResponse(
            True,
            "Failed to update trainable flags",
            {"error": str(e)},
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

# =======================
# 🗑️ Delete Document (Soft Delete)
# =======================
@router.delete("/delete/{document_id}")
async def delete_document(document_id: str, request: Request):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(
            True,
            "Unauthorized",
            None,
            status.HTTP_401_UNAUTHORIZED,
        )

    org_id = claims.get("organization_id")

    try:
        async with get_db_cursor(commit=True) as cur:

            # 1️⃣ Verify document exists & ownership
            await cur.execute(
                """
                SELECT id, s3_key
                FROM documents
                WHERE id=%s
                  AND organization_id=%s
                  AND deleted_at IS NULL
                """,
                (document_id, org_id),
            )
            doc = await cur.fetchone()

            if not doc:
                return APIResponse(
                    True,
                    "Document not found",
                    None,
                    status.HTTP_404_NOT_FOUND,
                )

            # 2️⃣ Drop the embeddings. The document row is kept (soft delete)
            # but its chunks are dead weight: they are filtered out of every
            # query, yet still occupy the table and the HNSW index, which
            # slows every search that walks past them.
            await cur.execute(
                "DELETE FROM document_chunks WHERE document_id = %s",
                (document_id,),
            )

            # 3️⃣ Soft delete
            await cur.execute(
                """
                UPDATE documents
                SET deleted_at = NOW(),
                    last_trained_at = NULL,
                    status = 'untrained',
                    updated_at = NOW()
                WHERE id=%s
                  AND organization_id=%s
                """,
                (document_id, org_id),
            )

        # 4️⃣ Drop the stored file, after the transaction has committed.
        # There is no restore path, so a kept blob is pure cost -- on S3 it
        # is billed every month forever. A failure here must not fail the
        # request: the document is already gone from the user's view, and an
        # orphaned file is better than an error for work that succeeded.
        if doc.get("s3_key"):
            try:
                await storage.delete_file(doc["s3_key"])
            except storage.StorageError as exc:
                logger.warning(
                    f"[DELETE] document {document_id} deleted, "
                    f"but its stored file remains: {exc}"
                )

        return APIResponse(
            False,
            "Document deleted successfully",
            None,
        )

    except Exception as e:
        logger.error(f"[DELETE ERROR] {e}")
        return APIResponse(
            True,
            "Failed to delete document",
            {"error": str(e)},
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
