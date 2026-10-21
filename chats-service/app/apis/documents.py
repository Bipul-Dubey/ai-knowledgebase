import logging
from fastapi import APIRouter, Request, UploadFile, File, status, HTTPException, Query
from fastapi.responses import FileResponse
from app.utils.response import APIResponse
from app.database.postgres_client import get_db_cursor
from app.helpers import file_manager, storage
from app.helpers.train_document import run_training_job
from app.core.config import settings
from pydantic import BaseModel
from pathlib import Path
from typing import List, Optional
from hashlib import sha256

logger = logging.getLogger(__name__)


def _mb(num_bytes: int) -> str:
    """Byte count as MB, for limit messages people have to act on."""
    return f"{num_bytes / (1024 * 1024):.1f} MB"

router = APIRouter(prefix="/documents", tags=["Documents"])

# =======================
# 📄 1️⃣ Upload Document
# =======================
@router.post("/upload")
async def upload_documents(request: Request, files: List[UploadFile] = File(...)):
    """Upload one or more documents.

    Limits are per organization, not per request: an org may hold
    MAX_DOCUMENTS_PER_ORG documents and MAX_ORG_STORAGE_BYTES in total, with
    each file under MAX_FILE_SIZE_BYTES.

    The whole batch is validated before anything is written, so a bad file
    never leaves a half-finished upload behind.
    """
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")
    user_id = claims.get("user_id")

    if not files:
        return APIResponse(
            True, "No files were uploaded", None, status.HTTP_400_BAD_REQUEST
        )

    # ---------------------------------------------------------- quota
    async with get_db_cursor() as cur:
        await cur.execute(
            """
            SELECT COUNT(*) AS used_count,
                   COALESCE(SUM(file_size), 0) AS used_bytes
            FROM documents
            WHERE organization_id = %s
              AND deleted_at IS NULL
            """,
            (org_id,),
        )
        usage = await cur.fetchone()

    used_count = usage["used_count"]
    used_bytes = usage["used_bytes"]
    free_slots = settings.MAX_DOCUMENTS_PER_ORG - used_count
    free_bytes = settings.MAX_ORG_STORAGE_BYTES - used_bytes

    if free_slots <= 0:
        return APIResponse(
            True,
            f"Document limit reached ({settings.MAX_DOCUMENTS_PER_ORG}). "
            "Delete a document before uploading another.",
            None,
            status.HTTP_400_BAD_REQUEST,
        )

    if len(files) > free_slots:
        return APIResponse(
            True,
            f"Only {free_slots} more "
            f"{'document' if free_slots == 1 else 'documents'} can be added "
            f"({used_count} of {settings.MAX_DOCUMENTS_PER_ORG} used), "
            f"but {len(files)} were selected.",
            None,
            status.HTTP_400_BAD_REQUEST,
        )

    # ------------------------------------------------------ validation
    allowed = file_manager.supported_extensions()
    rejected: list[dict] = []
    batch_bytes = 0
    seen_names: set[str] = set()

    for upload in files:
        name = upload.filename or "unnamed"
        ext = Path(name).suffix.lower()

        if name in seen_names:
            rejected.append({"file_name": name, "reason": "Selected twice"})
            continue
        seen_names.add(name)

        if ext not in allowed:
            # Name the modern format rather than saying "unsupported".
            replacement = file_manager.legacy_replacement(ext)
            reason = (
                f"{ext or 'This file type'} is not supported"
                + (f" - convert it to {replacement}" if replacement else "")
            )
            rejected.append({"file_name": name, "reason": reason})
            continue

        # .size avoids reading the body just to measure it.
        size = upload.size
        if size is None:
            size = len(await upload.read())
            await upload.seek(0)

        if size == 0:
            rejected.append({"file_name": name, "reason": "File is empty"})
            continue

        if size > settings.MAX_FILE_SIZE_BYTES:
            rejected.append(
                {
                    "file_name": name,
                    "reason": f"Larger than the {_mb(settings.MAX_FILE_SIZE_BYTES)} "
                    f"per-file limit ({_mb(size)})",
                }
            )
            continue

        batch_bytes += size

    if rejected:
        return APIResponse(
            True,
            "Some files could not be uploaded",
            {"uploaded": [], "rejected": rejected},
            status.HTTP_400_BAD_REQUEST,
        )

    if batch_bytes > free_bytes:
        return APIResponse(
            True,
            f"Not enough storage: {_mb(free_bytes)} free of "
            f"{_mb(settings.MAX_ORG_STORAGE_BYTES)}, "
            f"but the selection is {_mb(batch_bytes)}.",
            None,
            status.HTTP_400_BAD_REQUEST,
        )

    # ---------------------------------------------------------- write
    uploaded: list[dict] = []
    failed: list[dict] = []

    for upload in files:
        try:
            file_bytes = await upload.read()
            file_size = len(file_bytes)
            # Lets training skip a document whose bytes have not changed.
            content_hash = sha256(file_bytes).hexdigest()

            s3_key, _presigned_url, _expires_at = storage.upload_file(
                file_bytes=file_bytes,
                org_id=org_id,
                filename=upload.filename,
                content_type=upload.content_type
                or storage.guess_media_type(upload.filename or ""),
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
                    (
                        user_id,
                        org_id,
                        upload.filename,
                        s3_key,
                        file_size,
                        content_hash,
                    ),
                )
                uploaded.append(await cur.fetchone())

        except Exception as e:
            # One bad file must not discard the ones that worked.
            logger.error(f"[UPLOAD ERROR] {upload.filename}: {e}")
            failed.append({"file_name": upload.filename, "reason": str(e)})

    if not uploaded:
        return APIResponse(
            True,
            "Failed to upload documents",
            {"uploaded": [], "rejected": failed},
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    count = len(uploaded)
    message = f"{count} {'document' if count == 1 else 'documents'} uploaded"
    if failed:
        message += f", {len(failed)} failed"

    return APIResponse(
        bool(failed), message, {"uploaded": uploaded, "rejected": failed}
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
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
):
    """Paginated document list.

    Search and paging both run in the database: filtering one page in the
    browser would hide matches sitting on other pages.
    """
    claims = getattr(request.state, "claims", None)
    if not claims:
        raise HTTPException(status_code=401, detail="Unauthorized")

    org_id = claims.get("organization_id")

    where = """
        WHERE organization_id = %(org)s
          AND deleted_at IS NULL
    """
    params: dict = {"org": org_id}

    if status_filter:
        where += " AND status = %(status)s"
        params["status"] = status_filter

    if search and search.strip():
        where += " AND file_name ILIKE %(search)s"
        params["search"] = f"%{search.strip()}%"

    async with get_db_cursor() as cur:
        # Count under the same filter, so total_pages matches what is shown.
        await cur.execute(f"SELECT COUNT(*) AS total FROM documents {where}", params)
        total = (await cur.fetchone())["total"]

        await cur.execute(
            f"""
            SELECT id, file_name, status, created_at, file_size
            FROM documents
            {where}
            ORDER BY created_at DESC
            LIMIT %(limit)s OFFSET %(offset)s
            """,
            {**params, "limit": limit, "offset": (page - 1) * limit},
        )
        documents = await cur.fetchall()

    return APIResponse(
        False,
        "Documents fetched successfully",
        {
            "documents": documents,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit if total else 0,
        },
    )


@router.get("/stats")
async def document_stats(request: Request):
    """Organization-wide usage and the limits it is measured against.

    Separate from /resources on purpose: that list is one page, so summing
    it would under-count usage and let an org exceed its quota.
    """
    claims = getattr(request.state, "claims", None)
    if not claims:
        raise HTTPException(status_code=401, detail="Unauthorized")

    org_id = claims.get("organization_id")

    async with get_db_cursor() as cur:
        await cur.execute(
            """
            SELECT
                COUNT(*) AS used_count,
                COALESCE(SUM(file_size), 0) AS used_bytes,
                COUNT(*) FILTER (WHERE status = 'trained') AS trained,
                COUNT(*) FILTER (WHERE status = 'training') AS training,
                COUNT(*) FILTER (WHERE status = 'untrained') AS untrained,
                COUNT(*) FILTER (WHERE status = 'failed') AS failed
            FROM documents
            WHERE organization_id = %s
              AND deleted_at IS NULL
            """,
            (org_id,),
        )
        usage = await cur.fetchone()

    return APIResponse(
        False,
        "Document stats fetched successfully",
        {
            **usage,
            # Served rather than duplicated in the client, so the limits can
            # change in one place.
            "max_documents": settings.MAX_DOCUMENTS_PER_ORG,
            "max_storage_bytes": settings.MAX_ORG_STORAGE_BYTES,
            "max_file_size_bytes": settings.MAX_FILE_SIZE_BYTES,
        },
    )


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
