import boto3
from botocore.client import Config
import uuid
from datetime import datetime, timedelta
from app.core.config import settings
import tempfile
from botocore.exceptions import BotoCoreError, ClientError


AWS_ACCESS_KEY = settings.AWS_ACCESS_KEY_ID
AWS_SECRET_KEY = settings.AWS_SECRET_ACCESS_KEY
AWS_REGION = settings.AWS_REGION 
S3_BUCKET = settings.AWS_S3_BUCKET

s3_client = boto3.client(
    "s3",
    region_name="ap-south-1",
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY,
    config=Config(
        signature_version="s3v4",
        s3={"addressing_style": "path"}
    )
)


def generate_s3_key(org_id: str, filename: str) -> str:
    safe_filename = filename.replace(" ", "_")
    return f"organizations/{org_id}/documents/{uuid.uuid4()}_{safe_filename}"


def upload_file_to_s3(file_bytes: bytes, org_id: str, filename: str, content_type: str, expires_in: int = 3600):
    """
    Upload file to S3 and return presigned URL & S3 key
    """
    s3_key = generate_s3_key(org_id, filename)
    
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=s3_key,
        Body=file_bytes,
        ContentType=content_type,
    )

    presigned_url = get_presigned_url(s3_key=s3_key)

    expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
    return s3_key, presigned_url, expires_at


def get_presigned_url(s3_key: str, expires_in: int = 3600) -> str:
    return s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": s3_key},
        ExpiresIn=expires_in
    )


async def download_file_from_s3(s3_key: str) -> bytes:
    try:
        response = s3_client.get_object(Bucket=settings.AWS_S3_BUCKET, Key=s3_key)
        return response['Body'].read()
    except (BotoCoreError, ClientError) as e:
        raise RuntimeError(f"Failed to download file from S3: {str(e)}")