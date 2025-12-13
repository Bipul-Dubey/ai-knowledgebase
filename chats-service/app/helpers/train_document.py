import asyncio
import traceback
import numpy as np
from celery import Celery
from celery.signals import worker_process_init

from app.database.postgres_client import get_db_cursor
from app.helpers.file_manager import FileManager
from app.helpers.get_embedding_with_retry import get_embedding_with_retry
from app.core.config import settings
import app.database.postgres_client as pg


# PostgreSQL Initialization (per worker)
@worker_process_init.connect
def init_worker_db(**kwargs):
    asyncio.run(pg.init_db())


# Celery Setup
celery_app = Celery(
    "train_worker",
    broker=settings.RABBITMQ_URL,
    backend=settings.RABBITMQ_BACKEND,
)

celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_delivery_mode="persistent",
)


# Training Job Status (SCHEMA SAFE)
async def update_training_job_status(
    job_id: str,
    status: str,
    error_message: str | None = None,
    total_chunks: int | None = None,
):
    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            """
            UPDATE training_jobs
            SET status = %s,
                error_message = %s,
                total_chunks = COALESCE(%s, total_chunks),
                updated_at = NOW(),
                finished_at =
                    CASE
                        WHEN %s IN ('completed','failed','partial_failed')
                        THEN NOW()
                        ELSE finished_at
                    END
            WHERE id = %s
            """,
            (
                status,
                error_message,
                total_chunks,
                status,
                job_id,
            ),
        )


# Document Status
async def update_document_status(doc_id, status, error_message=None):
    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            """
            UPDATE documents
            SET status = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (status, doc_id),
        )


# Utility: safe embedding conversion
def _to_float_array(x):
    if isinstance(x, (list, tuple)):
        try:
            return np.array([float(i) for i in x], dtype=float)
        except Exception:
            pass
    return np.array([], dtype=float)


# Training Logic (BASE RAG — DOCUMENTS ONLY)
async def train_sources(
    job_id: str,
    org_id: str,
    user_id: str,
    document_ids: list[str] | None = None,
):
    total_chunks = 0
    any_success = False
    any_fail = False

    document_ids = document_ids or []

    await update_training_job_status(job_id, "running")

    # Fetch documents
    async with get_db_cursor() as cur:
        if document_ids:
            await cur.execute(
                """
                SELECT id, s3_key
                FROM documents
                WHERE organization_id = %s
                  AND id = ANY(%s)
                  AND trainable = TRUE
                """,
                (org_id, document_ids),
            )
        else:
            await cur.execute(
                """
                SELECT id, s3_key
                FROM documents
                WHERE organization_id = %s
                  AND trainable = TRUE
                """,
                (org_id,),
            )

        documents = await cur.fetchall()

    # Process documents
    for doc in documents:
        doc_id = doc["id"]
        await update_document_status(doc_id, "processing")

        try:
            content = await FileManager.get_text_from_source(
                {"s3_key": doc["s3_key"]}
            )
            if not content.strip():
                raise ValueError("Empty document")

            chunks = FileManager.chunk_text(content)
            if not chunks:
                raise ValueError("No chunks generated")

            embeddings = []
            for chunk in chunks:
                emb = await get_embedding_with_retry(chunk, org_id, user_id)
                arr = _to_float_array(emb)
                if arr.size == 0:
                    raise ValueError("Invalid embedding")
                embeddings.append(arr.tolist())

            async with get_db_cursor(commit=True) as cur:
                await cur.execute(
                    "DELETE FROM document_chunks WHERE document_id = %s",
                    (doc_id,),
                )

                for idx, chunk in enumerate(chunks):
                    emb_literal = "[" + ",".join(map(str, embeddings[idx])) + "]"

                    await cur.execute(
                        """
                        INSERT INTO document_chunks (
                            document_id,
                            organization_id,
                            chunk_index,
                            chunk_text,
                            embedding
                        )
                        VALUES (%s, %s, %s, %s, %s::vector)
                        """,
                        (
                            doc_id,
                            org_id,
                            idx,
                            chunk,
                            emb_literal,
                        ),
                    )

            await update_document_status(doc_id, "active")
            total_chunks += len(chunks)
            any_success = True

            await update_training_job_status(
                job_id,
                "running",
                total_chunks=total_chunks,
            )

        except Exception as e:
            traceback.print_exc()
            await update_document_status(doc_id, "failed", str(e))
            any_fail = True

    # Final Status
    final_status = (
        "partial_failed" if any_success and any_fail
        else "completed" if any_success
        else "failed"
    )

    await update_training_job_status(
        job_id,
        final_status,
        total_chunks=total_chunks,
    )

    print(
        f"🏁 Job {job_id} → {final_status} | chunks={total_chunks}"
    )


# Celery Entry
@celery_app.task(bind=True, max_retries=3)
def run_training_job(self, job_id, org_id, user_id, document_ids=None):
    print("🔥🔥🔥🔥🔥🔥🔥🔥 TRAIN_DOCUMENT 🔥🔥🔥🔥🔥🔥🔥🔥")
    try:
        print(f"🚀 Starting training job {job_id}")
        asyncio.run(train_sources(job_id, org_id, user_id, document_ids))
        return f"✅ Job {job_id} completed"
    except Exception as e:
        traceback.print_exc()
        asyncio.run(update_training_job_status(job_id, "failed", str(e)))
        raise self.retry(exc=e, countdown=5)
