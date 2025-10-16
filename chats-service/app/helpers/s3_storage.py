import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError
from datetime import datetime, timedelta, timezone
import uuid
from app.core.config import settings
from app.database.helpers import get_db_cursor
import asyncio

# ==========================
# 🔧 AWS S3 Configuration
# ==========================
S3_BUCKET = settings.AWS_S3_BUCKET

s3_client = boto3.client(
    "s3",
    region_name=settings.AWS_REGION,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"})
)

# ==========================
# 📦 Upload Helpers
# ==========================
def generate_s3_key(org_id: str, filename: str) -> str:
    safe_filename = filename.replace(" ", "_")
    return f"organizations/{org_id}/documents/{uuid.uuid4()}_{safe_filename}"


def upload_file_to_s3(
    file_bytes: bytes,
    org_id: str,
    filename: str,
    content_type: str,
    expires_in: int = 3600
):
    """
    Upload a file to S3 and return (s3_key, presigned_url, expires_at).
    """
    s3_key = generate_s3_key(org_id, filename)

    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=s3_key,
        Body=file_bytes,
        ContentType=content_type,
    )

    presigned_url, expires_at = get_presigned_url(s3_key, return_expiry=True, expires_in=expires_in)
    return s3_key, presigned_url, expires_at


# ==========================
# 🔗 Presigned URL Helpers
# ==========================
def get_presigned_url(s3_key: str, return_expiry: bool = False, expires_in: int = 3600):
    """
    Generate a presigned URL for an S3 object.
    """
    presigned_url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": s3_key},
        ExpiresIn=expires_in
    )

    if return_expiry:
        expires_at = datetime.utcnow().replace(tzinfo=timezone.utc) + timedelta(seconds=expires_in)
        return presigned_url, expires_at
    return presigned_url


# ==========================
# ⬇️ Download Helper
# ==========================
async def download_file_from_s3(s3_key: str) -> bytes:
    """
    Async wrapper for downloading file bytes from S3.
    """
    loop = asyncio.get_running_loop()
    try:
        response = await loop.run_in_executor(None, lambda: s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key))
        return response["Body"].read()
    except (BotoCoreError, ClientError) as e:
        raise RuntimeError(f"Failed to download file from S3: {str(e)}")


# ==========================
# 🚫 URL Invalidation Helper
# ==========================
async def invalidate_presigned_url(document_id: str):
    """
    Invalidate the saved presigned URL for a document.
    Sets s3_url_expires_at = NOW() to force regeneration next time.
    """
    try:
        async with get_db_cursor(commit=True) as cur:
            await cur.execute(
                """
                UPDATE documents
                SET s3_url = NULL,
                    s3_url_expires_at = NOW() - INTERVAL '1 second',
                    updated_at = NOW()
                WHERE id = %s
                """,
                (document_id,)
            )
        print(f"[S3 INVALIDATE] Presigned URL invalidated for document {document_id}")
    except Exception as e:
        print(f"[S3 INVALIDATE ERROR] Failed to invalidate URL for {document_id}: {e}")
