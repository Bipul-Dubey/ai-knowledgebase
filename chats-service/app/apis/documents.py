from fastapi import APIRouter, Request, UploadFile, File, status
from app.utils.response import APIResponse
from app.database.helpers import get_db_cursor
from app.helpers.s3_storage import upload_file_to_s3, get_presigned_url
from app.helpers.train_document import run_training_job
from pydantic import BaseModel, HttpUrl
from typing import List, Optional

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
        s3_key, presigned_url, expires_at = upload_file_to_s3(
            file_bytes, org_id, file.filename, file.content_type
        )

        async with get_db_cursor() as cur:
            await cur.execute(
                """
                INSERT INTO documents 
                (id, organization_id, created_by, file_name, file_type, s3_key, s3_url, s3_url_expires_at, status, created_at, updated_at)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, 'active', NOW(), NOW())
                RETURNING *
                """,
                (org_id, user_id, file.filename, file.content_type, s3_key, presigned_url, expires_at)
            )
            document = await cur.fetchone()

        return APIResponse(False, "Document uploaded successfully", document, status.HTTP_200_OK)

    except Exception as e:
        print(f"[UPLOAD ERROR] {e}")
        return APIResponse(True, f"Failed to upload: {str(e)}", None, status.HTTP_500_INTERNAL_SERVER_ERROR)


# =======================
# 🌐 2️⃣ Submit URL
# =======================
class URLSubmitRequest(BaseModel):
    url: HttpUrl
    title: Optional[str] = None

@router.post("/url")
async def submit_url(request: Request, body: URLSubmitRequest):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")
    user_id = claims.get("user_id")

    try:
        async with get_db_cursor() as cur:
            await cur.execute(
                """
                INSERT INTO urls (organization_id, url, title, status, created_at)
                VALUES (%s, %s, %s, 'active', NOW())
                RETURNING *
                """,
                (org_id, body.url, body.title)
            )
            record = await cur.fetchone()

        return APIResponse(False, "URL submitted successfully", record, status.HTTP_200_OK)

    except Exception as e:
        print(f"[URL SUBMIT ERROR] {e}")
        return APIResponse(True, f"Failed to process URL: {str(e)}", None, status.HTTP_500_INTERNAL_SERVER_ERROR)


@router.get("/download/{document_id}")
async def download_document(document_id: str, request: Request):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")

    async with get_db_cursor() as cur:
        await cur.execute(
            "SELECT s3_key FROM documents WHERE id = %s AND organization_id = %s",
            (document_id, org_id)
        )
        doc = await cur.fetchone()
        if not doc:
            return APIResponse(True, "Document not found", None, status.HTTP_404_NOT_FOUND)

        presigned_url = get_presigned_url(doc["s3_key"])
        return APIResponse(False, "Document URL generated", {"url": presigned_url}, status.HTTP_200_OK)



# -----------------------------
# Request Model
# -----------------------------
class TrainRequest(BaseModel):
    document_ids: Optional[List[str]] = None
    url_ids: Optional[List[str]] = None


# -----------------------------
# Train Endpoint
# -----------------------------
@router.post("/train")
async def train_documents_endpoint(request: Request, body: TrainRequest):
    """
    Creates a training job and enqueues it to Celery/RabbitMQ.
    - If no document_ids or url_ids provided → train all.
    - Otherwise, train only provided IDs.
    """
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")
    user_id = claims.get("user_id")

    document_ids = body.document_ids or []
    url_ids = body.url_ids or []

    try:
        # Fetch all if no IDs passed
        if not document_ids and not url_ids:
            async with get_db_cursor() as cur:
                await cur.execute("SELECT id FROM documents WHERE organization_id=%s", (org_id,))
                docs = await cur.fetchall()
                document_ids = [d["id"] for d in docs]

                await cur.execute("SELECT id FROM urls WHERE organization_id=%s", (org_id,))
                urls = await cur.fetchall()
                url_ids = [u["id"] for u in urls]

        total_sources = len(document_ids) + len(url_ids)

        # Create new training job record
        async with get_db_cursor(commit=True) as cur:
            await cur.execute(
                """
                INSERT INTO training_jobs
                    (id, organization_id, initiated_by, status, total_documents, created_at)
                VALUES
                    (gen_random_uuid(), %s, %s, 'pending', %s, NOW())
                RETURNING id
                """,
                (org_id, user_id, total_sources)
            )
            job = await cur.fetchone()
            job_id = job["id"]

        # Send async job to RabbitMQ (Celery)
        run_training_job.delay(job_id, org_id, user_id, document_ids, url_ids)

        return APIResponse(
            False,
            "Training job queued successfully",
            {"job_id": job_id, "total_sources": total_sources},
            status.HTTP_202_ACCEPTED
        )

    except Exception as e:
        print(f"[TRAIN ENDPOINT ERROR] {e}")
        return APIResponse(
            True,
            "Failed to create training job",
            {"error": str(e)},
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )