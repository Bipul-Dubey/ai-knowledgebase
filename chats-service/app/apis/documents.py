from fastapi import APIRouter, Request, UploadFile, File, status, HTTPException, Query
from app.utils.response import APIResponse
from app.database.postgres_client import get_db_cursor
from app.helpers.s3_storage import upload_file_to_s3, get_presigned_url
from app.helpers.train_document import run_training_job
from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime, timezone
from hashlib import sha256
import json

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
        file_hash = sha256(file_bytes).hexdigest()

        metadata = {"original_filename": file.filename}

        s3_key, presigned_url, expires_at = upload_file_to_s3(
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
                     status, trainable, created_at, updated_at)
                VALUES (%s, %s, %s, %s, 'active', TRUE, NOW(), NOW())
                RETURNING id, file_name, created_at
                """,
                (user_id, org_id, file.filename, s3_key),
            )
            document = await cur.fetchone()

        return APIResponse(False, "Document uploaded successfully", document)

    except Exception as e:
        print(f"[UPLOAD ERROR] {e}")
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
                WHERE id=%s AND organization_id=%s AND status='active'
                """,
                (document_id, org_id),
            )
            doc = await cur.fetchone()

        if not doc:
            return APIResponse(True, "Document not found", None, status.HTTP_404_NOT_FOUND)

        presigned_url, expires_at = get_presigned_url(
            s3_key=doc["s3_key"], return_expiry=True
        )

        return APIResponse(
            False,
            "Document URL generated",
            {"url": presigned_url, "expires_at": expires_at},
        )

    except Exception as e:
        print(f"[DOWNLOAD ERROR] {e}")
        return APIResponse(
            True,
            "Failed to generate download URL",
            {"error": str(e)},
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

# =======================
# 🧠 3️⃣ Train Documents
# =======================
class TrainRequest(BaseModel):
    document_ids: Optional[List[str]] = None

@router.post("/train")
async def train_documents_endpoint(request: Request, body: TrainRequest):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")
    user_id = claims.get("user_id")
    document_ids = body.document_ids or []

    try:
        if not document_ids:
            async with get_db_cursor() as cur:
                await cur.execute(
                    "SELECT id FROM documents WHERE organization_id=%s AND trainable=TRUE",
                    (org_id,),
                )
                rows = await cur.fetchall()
                document_ids = [r["id"] for r in rows]

        async with get_db_cursor(commit=True) as cur:
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

        run_training_job.delay(job["id"], org_id, user_id, document_ids)

        return APIResponse(
            False,
            "Training job queued successfully",
            {"job_id": job["id"], "total_documents": len(document_ids)},
            status.HTTP_202_ACCEPTED,
        )

    except Exception as e:
        print(f"[TRAIN ERROR] {e}")
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
            SELECT id, file_name, status, created_at
            FROM documents
            WHERE organization_id = %s
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
        print(f"[TRAINABLE ERROR] {e}")
        return APIResponse(
            True,
            "Failed to update trainable flags",
            {"error": str(e)},
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
