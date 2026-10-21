import asyncio
import traceback
from hashlib import sha256

from celery import Celery
from celery.signals import worker_process_init

from app.database.postgres_client import get_db_cursor
from app.helpers.file_manager import FileManager
from app.helpers.get_embedding_with_retry import embed_texts
from app.helpers.token_usage import UsageAccumulator
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


def index_fingerprint(content_hash: str | None) -> str:
    """Identity of a document's index: its content *and* how it was indexed.

    Hashing the chunking and embedding settings in means that changing chunk
    size or the embedding model invalidates every fingerprint, so the next run
    re-embeds instead of silently skipping stale vectors.
    """
    parts = [
        content_hash or "",
        settings.EMBEDDING_MODEL,
        str(settings.EMBEDDING_DIM),
        str(settings.CHUNK_SIZE),
        str(settings.CHUNK_OVERLAP),
        "ctxhdr" if settings.CONTEXTUAL_CHUNK_HEADER else "plain",
    ]
    return sha256("|".join(parts).encode()).hexdigest()


async def mark_document_indexed(doc_id: str, fingerprint: str) -> None:
    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            """
            UPDATE documents
            SET status = 'trained',
                index_fingerprint = %s,
                last_trained_at = NOW(),
                updated_at = NOW()
            WHERE id = %s
              AND deleted_at IS NULL
            """,
            (fingerprint, doc_id),
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
        if status == "trained":
            await cur.execute(
                """
                UPDATE documents
                SET status = %s,
                    last_trained_at = NOW(),
                    updated_at = NOW()
                WHERE id = %s
                  AND deleted_at IS NULL
                """,
                (status, doc_id),
            )
        elif status == "failed":
            await cur.execute(
                """
                UPDATE documents
                SET status = %s,
                    last_trained_at = NULL,
                    updated_at = NOW()
                WHERE id = %s
                  AND deleted_at IS NULL
                """,
                (status, doc_id),
            )
        else:
            await cur.execute(
                """
                UPDATE documents
                SET status = %s,
                    updated_at = NOW()
                WHERE id = %s
                  AND deleted_at IS NULL
                """,
                (status, doc_id),
            )


# Training Logic (BASE RAG — DOCUMENTS ONLY)
async def train_sources(
    job_id: str,
    org_id: str,
    user_id: str,
    document_ids: list[str] | None = None,
    force: bool = False,
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
                SELECT id, s3_key, file_name, content_hash, index_fingerprint
                FROM documents
                WHERE organization_id = %s
                AND id = ANY(%s)
                AND trainable = TRUE
                AND deleted_at IS NULL
                """,
                (org_id, document_ids),
            )
        else:
            await cur.execute(
                """
                SELECT id, s3_key, file_name, content_hash, index_fingerprint
                FROM documents
                WHERE organization_id = %s
                AND trainable = TRUE
                AND deleted_at IS NULL
                """,
                (org_id,),
            )

        documents = await cur.fetchall()

    # One accumulator for the whole job: the embedding loop would otherwise
    # upsert the same contended token_usage row once per chunk.
    usage = UsageAccumulator(settings.EMBEDDING_MODEL)

    # Process documents
    for doc in documents:
        doc_id = doc["id"]
        fingerprint = index_fingerprint(doc.get("content_hash"))

        # Nothing about the content or the indexing settings has changed, so
        # the stored vectors are still correct.
        if not force and doc.get("index_fingerprint") == fingerprint:
            print(f"[TRAIN] {doc['file_name']}: unchanged, skipped")
            await mark_document_indexed(doc_id, fingerprint)
            any_success = True
            continue

        await update_document_status(doc_id, "training")

        try:
            chunks = await FileManager.get_chunks(
                {"s3_key": doc["s3_key"]}, doc["file_name"]
            )
            if not chunks:
                raise ValueError("No chunks generated (empty or unreadable document)")

            # The header goes into the embedding only; chunk_text stays clean.
            embeddings = await embed_texts(
                [c.embed_text for c in chunks], org_id, user_id, usage=usage
            )

            rows = [
                (
                    doc_id,
                    org_id,
                    chunk.index,
                    chunk.text,
                    chunk.page,
                    chunk.section,
                    "[" + ",".join(map(str, vector)) + "]",
                )
                for chunk, vector in zip(chunks, embeddings)
            ]

            async with get_db_cursor(commit=True) as cur:
                await cur.execute(
                    "DELETE FROM document_chunks WHERE document_id = %s",
                    (doc_id,),
                )
                # One statement instead of one per chunk; psycopg pipelines it.
                await cur.executemany(
                    """
                    INSERT INTO document_chunks (
                        document_id,
                        organization_id,
                        chunk_index,
                        chunk_text,
                        page,
                        section,
                        embedding
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                    """,
                    rows,
                )

            await mark_document_indexed(doc_id, fingerprint)
            total_chunks += len(chunks)
            any_success = True
            pages = {c.page for c in chunks if c.page}
            print(
                f"[TRAIN] {doc['file_name']}: {len(chunks)} chunks"
                f"{f' across {len(pages)} pages' if pages else ''} embedded"
            )

            await update_training_job_status(
                job_id,
                "running",
                total_chunks=total_chunks,
            )

        except Exception as e:
            traceback.print_exc()
            await update_document_status(doc_id, "failed", str(e))
            any_fail = True

    # One token_usage write for the whole job.
    await usage.flush(org_id, user_id)

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
def run_training_job(self, job_id, org_id, user_id, document_ids=None, force=False):
    print("🔥🔥🔥🔥🔥🔥🔥🔥 TRAIN_DOCUMENT 🔥🔥🔥🔥🔥🔥🔥🔥")
    try:
        print(f"🚀 Starting training job {job_id}")
        asyncio.run(train_sources(job_id, org_id, user_id, document_ids, force))
        return f"✅ Job {job_id} completed"
    except Exception as e:
        traceback.print_exc()
        asyncio.run(update_training_job_status(job_id, "failed", str(e)))
        raise self.retry(exc=e, countdown=5)
