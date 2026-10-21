"""Document blob storage, with a development backend.

The backend follows ENV -- the same single switch the rest of the stack uses:

    ENV=development     files on local disk under LOCAL_STORAGE_DIR
    anything else       AWS S3

Only the exact value "development" selects local disk, so staging and
production always take the real path.

Both backends produce the same opaque key, and the key is what gets stored in
documents.s3_key, so switching backends needs no schema change. Nothing is
migrated on a switch: files written by one backend are invisible to the other.

S3 hands out presigned URLs -- time-limited links a browser can open with no
session of its own. The local backend has to reproduce that, because the
frontend opens the download URL in a new tab and a tab navigation carries no
Authorization header. So it signs the key and an expiry with HMAC-SHA256 and
serves the bytes from GET /api/v1/documents/local/{key}. The obvious
alternative -- a statically served directory -- would hand every tenant's
documents to anyone who could guess a path.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import mimetypes
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

from app.core.config import settings

# Kept here so the route and the URL builder cannot drift apart.
LOCAL_URL_PREFIX = "/api/v1/documents/local/"


class StorageError(Exception):
    """A storage operation could not be completed."""


class StorageDeletionError(StorageError):
    """Deleting a stored file failed."""


def is_local() -> bool:
    """True when documents live on local disk rather than S3."""
    return (settings.ENV or "").strip().lower() == "development"


def backend_name() -> str:
    return "local" if is_local() else "s3"


def _s3():
    # Imported lazily: app.helpers.s3_storage constructs a boto3 client at
    # import time, which is pointless in local mode and needs AWS settings
    # that a dev machine will not have.
    from app.helpers import s3_storage

    return s3_storage


# --------------------------------------------------------------- keys

_UNSAFE = re.compile(r"[^A-Za-z0-9._-]")


def build_key(org_id: str, filename: str) -> str:
    """Build the storage key for a new upload.

    The filename is reduced to a known-safe character set rather than merely
    having its spaces replaced. On the local backend the key becomes a real
    filesystem path, so an uploaded name containing "../" would otherwise walk
    straight out of the storage root.
    """
    stem = Path(filename or "file").name
    safe = _UNSAFE.sub("_", stem)
    # Collapse runs and drop underscores butting up against a dot, so
    # "my report (final).pdf" becomes "my_report_final.pdf" rather than
    # accumulating one underscore per stripped character.
    safe = re.sub(r"_+", "_", safe)
    safe = re.sub(r"_+(?=\.)", "", safe).strip("._") or "file"
    return f"organizations/{org_id}/documents/{uuid.uuid4()}_{safe}"


def original_filename(key: str) -> str:
    """Recover the uploaded name from a key, for Content-Disposition."""
    name = key.rsplit("/", 1)[-1]
    # Keys are "<uuid4>_<safe name>", and uuid4's hex form never contains "_".
    return name.split("_", 1)[-1] if "_" in name else name


def guess_media_type(key: str) -> str:
    return mimetypes.guess_type(key)[0] or "application/octet-stream"


# -------------------------------------------------------- local paths


def local_root() -> Path:
    return Path(settings.LOCAL_STORAGE_DIR).expanduser().resolve()


def local_path(key: str) -> Path:
    """Resolve a key to a path, refusing anything outside the storage root.

    build_key sanitises new uploads, but this is the last line of defence for
    a key that arrived from the database or a request path.
    """
    root = local_root()
    candidate = (root / key.lstrip("/")).resolve()
    if candidate != root and not candidate.is_relative_to(root):
        raise StorageError("storage key resolves outside the storage root")
    return candidate


# ------------------------------------------------------------ signing


def _signing_key() -> bytes:
    secret = settings.JWT_SECRET
    if not secret:
        raise StorageError("JWT_SECRET is required to sign local file URLs")
    return secret.encode()


def _sign(key: str, expires_at: int) -> str:
    digest = hmac.new(
        _signing_key(), f"{key}:{expires_at}".encode(), hashlib.sha256
    ).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


def verify_local_url(key: str, expires_at: int, signature: str) -> None:
    """Raise StorageError unless the signature is valid and still current.

    The expiry is part of the signed message, so it cannot be extended by
    editing the query string. Compared in constant time.
    """
    if not hmac.compare_digest(_sign(key, expires_at), signature):
        raise StorageError("invalid signature")
    if expires_at < int(time.time()):
        raise StorageError("link has expired")


# --------------------------------------------------------- public API


def upload_file(
    *,
    file_bytes: bytes,
    org_id: str,
    filename: str,
    content_type: str,
    expires_in: int = 3600,
):
    """Store bytes. Returns (key, url, url_expires_at)."""
    if not is_local():
        return _s3().upload_file_to_s3(
            file_bytes=file_bytes,
            org_id=org_id,
            filename=filename,
            content_type=content_type,
            expires_in=expires_in,
        )

    key = build_key(org_id, filename)
    path = local_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(file_bytes)

    url, expires_at = get_file_url(key, expires_in=expires_in, return_expiry=True)
    return key, url, expires_at


def get_file_url(key: str, *, expires_in: int = 3600, return_expiry: bool = False):
    """A time-limited URL the browser can open without a session."""
    if not is_local():
        return _s3().get_presigned_url(
            s3_key=key, return_expiry=return_expiry, expires_in=expires_in
        )

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    exp = int(expires_at.timestamp())
    url = (
        f"{settings.CHAT_PUBLIC_BASE_URL.rstrip('/')}{LOCAL_URL_PREFIX}"
        f"{quote(key)}?exp={exp}&sig={_sign(key, exp)}"
    )
    return (url, expires_at) if return_expiry else url


async def download_file(key: str) -> bytes:
    """Read the stored bytes back. Used by the training pipeline."""
    if not is_local():
        return await _s3().download_file_from_s3(key)

    path = local_path(key)
    if not path.is_file():
        raise StorageError(f"stored file is missing: {key}")
    return await asyncio.to_thread(path.read_bytes)


async def delete_file(key: str) -> None:
    if not is_local():
        try:
            await _s3().delete_s3_object(key)
        except Exception as exc:
            raise StorageDeletionError(str(exc)) from exc
        return

    path = local_path(key)
    try:
        await asyncio.to_thread(lambda: path.unlink(missing_ok=True))
    except OSError as exc:
        raise StorageDeletionError(f"failed to delete {key}: {exc}") from exc
