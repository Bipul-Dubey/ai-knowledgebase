from fastapi import APIRouter, Request, UploadFile, File, status, HTTPException, Query
from app.utils.response import APIResponse
from app.database.postgres_client import get_db_cursor
from app.helpers.s3_storage import upload_file_to_s3, get_presigned_url
from app.helpers.train_document import run_training_job
from pydantic import BaseModel, HttpUrl
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

    # Allowed document MIME types
    allowed_types = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]
    if file.content_type not in allowed_types:
        return APIResponse(True, f"File type '{file.content_type}' not allowed", None, status.HTTP_400_BAD_REQUEST)

    try:
        file_bytes = await file.read()
        file_size = len(file_bytes)
        file_hash = sha256(file_bytes).hexdigest()

        # Optional metadata placeholder
        metadata = {"original_filename": file.filename}

        # Upload to S3
        s3_key, presigned_url, expires_at = upload_file_to_s3(
            file_bytes=file_bytes,
            org_id=org_id,
            filename=file.filename,
            content_type=file.content_type,
        )

        # Insert into DB
        async with get_db_cursor(commit=True) as cur:
            await cur.execute(
                """
                INSERT INTO documents
                    (created_by, organization_id, file_name, file_type, file_size, s3_key, s3_url, s3_url_expires_at,
                     status, file_hash, metadata, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'active', %s, %s, NOW(), NOW())
                RETURNING id, file_name, file_type, file_size, s3_url, created_at
                """,
                (user_id, org_id, file.filename, file.content_type, file_size, s3_key, presigned_url, expires_at,
                 file_hash, json.dumps(metadata))
            )
            document = await cur.fetchone()

        return APIResponse(False, "Document uploaded successfully", document, status.HTTP_200_OK)

    except Exception as e:
        print(f"[UPLOAD ERROR] {e}")
        return APIResponse(True, f"Failed to upload document: {str(e)}", None, status.HTTP_500_INTERNAL_SERVER_ERROR)


# =======================
# 🌐 2️⃣ Upload URLs
# =======================
class URLItem(BaseModel):
    url: HttpUrl
    title: Optional[str] = None


class URLSubmitRequest(BaseModel):
    urls: List[URLItem]


@router.post("/urls")
async def submit_urls(request: Request, body: URLSubmitRequest):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")
    if not body.urls:
        return APIResponse(True, "No URLs provided", None, status.HTTP_400_BAD_REQUEST)

    try:
        async with get_db_cursor(commit=True) as cur:
            # Convert HttpUrl to str
            values = [
                (org_id, str(item.url), item.title or None, 'active', datetime.utcnow())
                for item in body.urls
            ]
            placeholders = ", ".join(["(%s,%s,%s,%s,%s)"] * len(values))
            flat_values = [v for tup in values for v in tup]

            query = f"""
                INSERT INTO urls (organization_id, url, title, status, created_at)
                VALUES {placeholders}
                RETURNING id, url, title, created_at
            """
            await cur.execute(query, flat_values)
            records = await cur.fetchall()

        return APIResponse(False, "URLs submitted successfully", records, status.HTTP_200_OK)

    except Exception as e:
        print(f"[URL SUBMIT ERROR] {e}")
        return APIResponse(True, f"Failed to process URLs: {str(e)}", None, status.HTTP_500_INTERNAL_SERVER_ERROR)


# =======================
# 📥 3️⃣ Download Document
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
                SELECT s3_key, s3_url, s3_url_expires_at
                FROM documents
                WHERE id=%s AND organization_id=%s AND status='active'
                """,
                (document_id, org_id)
            )
            doc = await cur.fetchone()

        if not doc:
            return APIResponse(True, "Document not found", None, status.HTTP_404_NOT_FOUND)

        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        if doc["s3_url"] and doc["s3_url_expires_at"] and doc["s3_url_expires_at"] > now:
            return APIResponse(False, "Document URL retrieved", {"url": doc["s3_url"]}, status.HTTP_200_OK)

        presigned_url, expires_at = get_presigned_url(s3_key=doc["s3_key"], return_expiry=True)

        # Update DB
        async with get_db_cursor(commit=True) as cur:
            await cur.execute(
                """
                UPDATE documents
                SET s3_url=%s, s3_url_expires_at=%s, updated_at=NOW()
                WHERE id=%s
                """,
                (presigned_url, expires_at, document_id)
            )

        return APIResponse(False, "New document URL generated", {"url": presigned_url}, status.HTTP_200_OK)

    except Exception as e:
        print(f"[DOWNLOAD ERROR] {e}")
        return APIResponse(True, f"Failed to generate download URL: {str(e)}", None, status.HTTP_500_INTERNAL_SERVER_ERROR)


# =======================
# 🧠 4️⃣ Train Documents
# =======================
class TrainRequest(BaseModel):
    document_ids: Optional[List[str]] = None
    url_ids: Optional[List[str]] = None


@router.post("/train")
async def train_documents_endpoint(request: Request, body: TrainRequest):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")
    user_id = claims.get("user_id")
    document_ids = body.document_ids or []
    url_ids = body.url_ids or []

    try:
        # Fetch all if no IDs provided
        if not document_ids and not url_ids:
            async with get_db_cursor() as cur:
                await cur.execute("SELECT id FROM documents WHERE organization_id=%s AND trainable = TRUE", (org_id,))
                docs = await cur.fetchall()
                document_ids = [d["id"] for d in docs]

                await cur.execute("SELECT id FROM urls WHERE organization_id=%s AND trainable = TRUE", (org_id,))
                urls = await cur.fetchall()
                url_ids = [u["id"] for u in urls]

        total_sources = len(document_ids) + len(url_ids)

        # Create training job
        async with get_db_cursor(commit=True) as cur:
            await cur.execute(
                """
                INSERT INTO training_jobs
                    (organization_id, initiated_by, status, total_documents, progress_percent, created_at, updated_at)
                VALUES (%s, %s, 'pending', %s, 0, NOW(), NOW())
                RETURNING id
                """,
                (org_id, user_id, total_sources)
            )
            job = await cur.fetchone()
            job_id = job["id"]

        # Enqueue Celery task
        run_training_job.delay(job_id, org_id, user_id, document_ids, url_ids)

        return APIResponse(
            False,
            "Training job queued successfully",
            {"job_id": job_id, "total_sources": total_sources},
            status.HTTP_202_ACCEPTED
        )

    except Exception as e:
        print(f"[TRAIN ENDPOINT ERROR] {e}")
        return APIResponse(True, "Failed to create training job", {"error": str(e)}, status.HTTP_500_INTERNAL_SERVER_ERROR)

# =======================
# GET Resources
# =======================
@router.get("/resources")
async def list_resources(
    request: Request,
    resource_type: Optional[str] = Query(None, description="Filter by 'document' or 'url'"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    limit: int = 50,
    offset: int = 0,
):
    """
    List organization resources (documents and URLs) in one API.
    Optional filters:
    - resource_type: 'document' or 'url'
    - status_filter: status of document/url
    """
    claims = getattr(request.state, "claims", None)
    if not claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    org_id = claims.get("organization_id")

    data = {}

    async with get_db_cursor() as cur:
        # ----------------------------
        # Fetch documents
        # ----------------------------
        if resource_type in (None, "document"):
            doc_query = """
                SELECT id, file_name AS name, file_type, file_size, status, created_at, updated_at, metadata
                FROM documents
                WHERE organization_id = %s
            """
            params = [org_id]
            if status_filter:
                doc_query += " AND status = %s"
                params.append(status_filter)
            doc_query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
            params.extend([limit, offset])

            await cur.execute(doc_query, tuple(params))
            documents = await cur.fetchall()
            data["documents"] = documents

        # ----------------------------
        # Fetch URLs
        # ----------------------------
        if resource_type in (None, "url"):
            url_query = """
                SELECT id, url AS name, title, status, last_fetched_at, created_at, metadata
                FROM urls
                WHERE organization_id = %s
            """
            params = [org_id]
            if status_filter:
                url_query += " AND status = %s"
                params.append(status_filter)
            url_query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
            params.extend([limit, offset])

            await cur.execute(url_query, tuple(params))
            urls = await cur.fetchall()
            data["urls"] = urls

    return APIResponse(False, "Resources fetched successfully", data)



# ===========
# Trainable
# ===========
class TrainableItem(BaseModel):
    entity_type: Literal["document", "url"]
    id: str
    trainable: bool

class TrainableUpdateBulkRequest(BaseModel):
    items: List[TrainableItem]

# ----------------------------
# API Endpoint
# ----------------------------
@router.patch("/set-trainable-bulk")
async def set_trainable_bulk(request: Request, body: TrainableUpdateBulkRequest):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")
    updated_ids = []

    table_map = {
        "document": "documents",
        "url": "urls"
    }

    try:
        async with get_db_cursor(commit=True) as cur:
            for item in body.items:
                table_name = table_map[item.entity_type]
                await cur.execute(
                    f"""
                    UPDATE {table_name}
                    SET trainable = %s,
                        updated_at = NOW()
                    WHERE organization_id = %s AND id = %s
                    """,
                    (item.trainable, org_id, item.id)
                )
                updated_ids.append(item.id)

        return APIResponse(
            False,
            "Trainable flags updated successfully",
            {"updated_ids": updated_ids},
            status.HTTP_200_OK
        )

    except Exception as e:
        print(f"[SET TRAINABLE BULK ERROR] {e}")
        return APIResponse(True, "Failed to update trainable flags", {"error": str(e)}, status.HTTP_500_INTERNAL_SERVER_ERROR)
