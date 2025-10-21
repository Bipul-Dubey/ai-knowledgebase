import asyncio
import traceback
from datetime import datetime
from celery import Celery
from app.database.helpers import get_db_cursor
from app.helpers.file_manager import FileManager
from app.helpers.get_embedding_with_retry import get_embedding_with_retry
from app.core.config import settings
import app.database.postgres_client as pg
import numpy as np
import ast
import json
import uuid

# ---------------------------
# PostgreSQL Initialization
# ---------------------------
async def init_pg():
    if pg.db is None:
        await pg.init_db()

def safe_init_pg():
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(init_pg())
    except RuntimeError:
        asyncio.run(init_pg())

safe_init_pg()

# ---------------------------
# Celery Setup
# ---------------------------
celery_app = Celery(
    "train_worker",
    broker=settings.RABBITMQ_URL,
    backend=settings.RABBITMQ_BACKEND
)

celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_delivery_mode="persistent",
)

# ---------------------------
# Status Helpers
# ---------------------------
async def update_training_job_status(job_id, status, error_message=None, total_chunks=None, completed_documents=None):
    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            """
            UPDATE training_jobs
            SET status = %s,
                error_message = %s,
                total_chunks = COALESCE(%s, total_chunks),
                total_documents = COALESCE(%s, total_documents),
                progress_percent = CASE WHEN total_documents > 0 THEN COALESCE(%s, completed_documents)/total_documents*100 ELSE 0 END,
                updated_at = NOW(),
                finished_at = CASE WHEN %s IN ('completed', 'failed', 'partial_failed') THEN NOW() ELSE finished_at END
            WHERE id = %s
            """,
            (status, error_message, total_chunks, completed_documents, completed_documents, status, job_id)
        )

async def update_document_status(doc_id, status, error_message=None):
    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            """
            UPDATE documents
            SET status = %s,
                updated_at = NOW(),
                metadata = jsonb_set(coalesce(metadata,'{}'::jsonb), '{error_message}', to_jsonb(%s::text), true)
            WHERE id = %s
            """,
            (status, error_message, doc_id)
        )

async def update_url_status(url_id, status, error_message=None):
    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            """
            UPDATE urls
            SET status=%s,
                updated_at=NOW(),
                metadata=jsonb_set(coalesce(metadata,'{}'::jsonb), '{error_message}', to_jsonb(%s::text), true)
            WHERE id=%s
            """,
            (status, error_message, url_id)
        )

# ---------------------------
# Cosine similarity helper (robust)
# ---------------------------
def _to_float_array(x):
    """
    Convert x to a 1-D numpy float array.
    Handles:
      - list/tuple of numbers
      - numpy arrays
      - strings like "[0.1, 0.2]" or "0.1,0.2"
      - sequences of Decimal
    """
    if x is None:
        return np.array([], dtype=float)

    # If already numpy array with numeric dtype, convert
    if isinstance(x, np.ndarray):
        try:
            return x.astype(float)
        except Exception:
            pass

    # If list/tuple => try convert
    if isinstance(x, (list, tuple)):
        try:
            return np.array([float(i) for i in x], dtype=float)
        except Exception:
            pass

    # If JSON/AST-parseable string (like "[0.1,...]")
    if isinstance(x, str):
        s = x.strip()
        # try JSON first
        try:
            parsed = json.loads(s)
            if isinstance(parsed, (list, tuple)):
                return np.array([float(i) for i in parsed], dtype=float)
        except Exception:
            pass
        # try ast literal_eval
        try:
            parsed = ast.literal_eval(s)
            if isinstance(parsed, (list, tuple)):
                return np.array([float(i) for i in parsed], dtype=float)
        except Exception:
            pass
        # fallback: split by commas
        try:
            parts = [p.strip() for p in s.strip("[]()").split(",") if p.strip() != ""]
            return np.array([float(p) for p in parts], dtype=float)
        except Exception:
            pass

    # Last-ditch attempt: convert via iteration
    try:
        iterable = list(x)
        return np.array([float(i) for i in iterable], dtype=float)
    except Exception:
        pass

    # Could not convert
    return np.array([], dtype=float)


def cosine_similarity(a, b):
    """
    Robust cosine similarity:
    - coerces inputs to float arrays
    - returns 0.0 for empty arrays or incompatible shapes
    - trims arrays to min length if shapes differ
    """
    a_arr = _to_float_array(a)
    b_arr = _to_float_array(b)

    if a_arr.size == 0 or b_arr.size == 0:
        return 0.0

    if a_arr.shape != b_arr.shape:
        # Trim to shortest length (safe fallback)
        min_len = min(a_arr.size, b_arr.size)
        a_arr = a_arr.flatten()[:min_len]
        b_arr = b_arr.flatten()[:min_len]

    denom = (np.linalg.norm(a_arr) * np.linalg.norm(b_arr) + 1e-10)
    if denom == 0:
        return 0.0
    return float(np.dot(a_arr, b_arr) / denom)

# ---------------------------
# Training Function
# ---------------------------
async def train_sources(job_id, org_id, user_id, document_ids=None, url_ids=None):
    total_chunks = 0
    completed_docs = 0
    any_success = False
    any_fail = False

    document_ids = document_ids or []
    url_ids = url_ids or []

    await update_training_job_status(job_id, "running")

    sources = []

    # -----------------------
    # Fetch Documents
    # -----------------------
    async with get_db_cursor() as cur:
        if document_ids:
            await cur.execute(
                "SELECT id, s3_key, file_name FROM documents WHERE organization_id=%s AND id=ANY(%s) AND trainable=TRUE",
                (org_id, document_ids)
            )
        else:
            await cur.execute(
                "SELECT id, s3_key, file_name FROM documents WHERE organization_id=%s AND trainable=TRUE",
                (org_id,)
            )
        docs = await cur.fetchall()
        for d in docs:
            sources.append({"id": d["id"], "type": "document", "s3_key": d["s3_key"], "file_name": d["file_name"]})

    # -----------------------
    # Fetch URLs
    # -----------------------
    async with get_db_cursor() as cur:
        if url_ids:
            await cur.execute(
                "SELECT id, url, title FROM urls WHERE organization_id=%s AND id=ANY(%s) AND trainable=TRUE",
                (org_id, url_ids)
            )
        else:
            await cur.execute(
                "SELECT id, url, title FROM urls WHERE organization_id=%s AND trainable=TRUE",
                (org_id,)
            )
        urls = await cur.fetchall()
        for u in urls:
            sources.append({"id": u["id"], "type": "url", "url": u["url"], "title": u["title"]})

    # -----------------------
    # Process each source
    # -----------------------
    for src in sources:
        src_id = src["id"]
        src_type = src["type"]

        if src_type == "document":
            await update_document_status(src_id, "processing")
        else:
            await update_url_status(src_id, "processing")

        # Extract text
        try:
            content = await FileManager.get_text_from_source(src)
            if not content or not content.strip():
                raise ValueError("No text extracted from source")
        except Exception as e:
            msg = f"[{src_type.upper()} FAIL] Download/Extract failed for {src_id}: {e}"
            print(msg)
            if src_type == "document":
                await update_document_status(src_id, "failed", msg)
            else:
                await update_url_status(src_id, "failed", msg)
            any_fail = True
            continue

        chunks = FileManager.chunk_text(content)
        if not chunks:
            msg = f"[{src_type.upper()} FAIL] No chunks generated for {src_id}"
            print(msg)
            if src_type == "document":
                await update_document_status(src_id, "failed", msg)
            else:
                await update_url_status(src_id, "failed", msg)
            any_fail = True
            continue

        embeddings = []
        chunk_ids = []
        src_failed = False

        # Generate embeddings
        for idx, chunk in enumerate(chunks):
            try:
                emb = await get_embedding_with_retry(chunk, org_id, user_id)
                # ensure we received a numeric list
                arr = _to_float_array(emb)
                if arr.size == 0:
                    raise ValueError("Received empty or non-numeric embedding")
                # prefer a specific expected dimension check if you have one (1536)
                # but avoid hard failure: warn and continue if mismatch isn't fatal
                embeddings.append(arr.tolist())
            except Exception as e:
                msg = f"[EMBED FAIL] {src_type} {src_id}, chunk {idx}: {e}"
                print(msg)
                src_failed = True
                any_fail = True
                break

        if src_failed:
            if src_type == "document":
                await update_document_status(src_id, "failed", "Embedding failed")
            else:
                await update_url_status(src_id, "failed", "Embedding failed")
            continue

        # -----------------------
        # Insert chunks & generate relations
        # -----------------------
        try:
            async with get_db_cursor(commit=True) as cur:
                # Clean old chunks
                if src_type == "document":
                    await cur.execute("DELETE FROM document_chunks WHERE document_id=%s", (src_id,))
                elif src_type == "url":
                    await cur.execute("DELETE FROM document_chunks WHERE url_id=%s", (src_id,))

                org_uuid = uuid.UUID(org_id) if isinstance(org_id, str) else org_id
                src_uuid = uuid.UUID(src_id) if isinstance(src_id, str) else src_id

                # Insert new chunks
                for idx, chunk in enumerate(chunks):
                    # build a numeric literal for pgvector insertion (floats only)
                    try:
                        # Use float conversion to avoid string types
                        vec = [float(v) for v in embeddings[idx]]
                        emb_literal = "[" + ",".join(map(str, vec)) + "]"
                    except Exception as e:
                        raise ValueError(f"Failed to convert embedding to floats for chunk {idx}: {e}")

                    await cur.execute(
                        """
                        INSERT INTO document_chunks
                            (id, document_id, url_id, organization_id, chunk_index, chunk_text, embedding, embedding_model, source_type, created_at)
                        VALUES
                            (gen_random_uuid(), %s, %s, %s, %s, %s, %s::vector, %s, %s, NOW())
                        RETURNING id
                        """,
                        (
                            src_uuid if src_type == "document" else None,
                            src_uuid if src_type == "url" else None,
                            org_uuid,
                            idx,
                            chunk,
                            emb_literal,
                            "text-embedding-3-small",
                            src_type,
                        ),
                    )
                    row = await cur.fetchone()
                    chunk_ids.append(row["id"])

                # Generate semantic relations within source (pairwise)
                  # -----------------------
                # Delete old relations for this source & org (retrain cleanup)
                # -----------------------
                await cur.execute(
                    "DELETE FROM chunk_relations WHERE org_id=%s AND source_id=%s AND source_type=%s",
                    (org_id, src_id, src_type)
                )

                for i in range(len(chunk_ids)):
                    for j in range(i + 1, len(chunk_ids)):
                        try:
                            score = cosine_similarity(embeddings[i], embeddings[j])
                        except Exception as e:
                            print(f"[RELATION WARN] similarity failed for {src_id} chunks {i},{j}: {e}")
                            continue
                        if score > 0.7:
                            await cur.execute(
                                """
                                INSERT INTO chunk_relations
                                    (from_chunk_id, to_chunk_id, relation_type, score, org_id, source_id, source_type, created_at)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                                """,
                                (
                                    chunk_ids[i],
                                    chunk_ids[j],
                                    "semantic",
                                    float(score),
                                    org_uuid,
                                    src_uuid,
                                    src_type
                                )
                            )

            if src_type == "document":
                await update_document_status(src_id, "active")
            else:
                await update_url_status(src_id, "active")

            total_chunks += len(chunks)
            completed_docs += 1
            any_success = True

            await update_training_job_status(
                job_id, "running", total_chunks=total_chunks, completed_documents=completed_docs
            )

        except Exception as e:
            msg = f"[DB FAIL] Failed to insert chunks for {src_type} {src_id}: {e}"
            print(msg)
            traceback.print_exc()
            if src_type == "document":
                await update_document_status(src_id, "failed", msg)
            else:
                await update_url_status(src_id, "failed", msg)
            any_fail = True
            continue

    # -----------------------
    # Final Job Status
    # -----------------------
    if any_success and any_fail:
        final_status = "partial_failed"
    elif any_success:
        final_status = "completed"
    else:
        final_status = "failed"

    await update_training_job_status(job_id, final_status, total_chunks=total_chunks, completed_documents=completed_docs)
    print(f"🏁 Job {job_id} finished → {final_status} | {completed_docs} sources | {total_chunks} chunks")

# ---------------------------
# Celery Task Entry
# ---------------------------
@celery_app.task(bind=True, max_retries=3)
def run_training_job(self, job_id, org_id, user_id, document_ids=None, url_ids=None):
    try:
        print(f"🚀 Starting training job {job_id}")
        asyncio.run(train_sources(job_id, org_id, user_id, document_ids, url_ids))
        return f"✅ Job {job_id} completed"
    except Exception as e:
        print(f"💥 Job {job_id} failed: {e}")
        traceback.print_exc()
        # Best-effort update job status (fire-and-forget)
        try:
            asyncio.run(update_training_job_status(job_id, "failed", str(e)))
        except Exception:
            pass
        raise self.retry(exc=e, countdown=5)
