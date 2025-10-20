import asyncio
import traceback
from celery import Celery
from app.database.helpers import get_db_cursor
from app.helpers.file_manager import FileManager
from app.core.config import settings
import app.database.postgres_client as pg
from app.helpers.get_embedding_with_retry import get_embedding_with_retry

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
# Database Status Helpers
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
                metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{error_message}', to_jsonb(%s::text), true)
            WHERE id = %s
            """,
            (status, error_message, doc_id)
        )

# ---------------------------
# Main Training Function
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

    # Fetch Documents
    if document_ids:
        async with get_db_cursor() as cur:
            await cur.execute(
                "SELECT id, s3_key, file_name FROM documents WHERE organization_id = %s AND id = ANY(%s) AND trainable = TRUE",
                (org_id, document_ids)
            )
            docs = await cur.fetchall()
            for d in docs:
                sources.append({
                    "id": d["id"],
                    "type": "document",
                    "s3_key": d["s3_key"],
                    "file_name": d["file_name"]
                })

    # Fetch URLs
    if url_ids:
        async with get_db_cursor() as cur:
            await cur.execute(
                "SELECT id, url, title FROM urls WHERE organization_id = %s AND id = ANY(%s) AND trainable = TRUE",
                (org_id, url_ids)
            )
            urls = await cur.fetchall()
            for u in urls:
                sources.append({
                    "id": u["id"],
                    "type": "url",
                    "url": u["url"],
                    "title": u["title"]
                })

    # Process each source
    for src in sources:
        src_id = src["id"]
        src_type = src["type"]

        # Mark as processing
        if src_type == "document":
            await update_document_status(src_id, "processing")

        try:
            content = await FileManager.get_text_from_source(src)
        except Exception as e:
            msg = f"[{src_type.upper()} FAIL] Download/Extract failed for {src_id}: {e}"
            print(msg)
            if src_type == "document":
                await update_document_status(src_id, "failed", msg)
            any_fail = True
            continue

        chunks = FileManager.chunk_text(content)
        embeddings = []
        src_failed = False

        # Generate embeddings (with internal token tracking)
        for idx, chunk in enumerate(chunks):
            try:
                emb = await get_embedding_with_retry(chunk, org_id, user_id)
                embeddings.append(emb)
            except Exception as e:
                msg = f"[EMBED FAIL] {src_type} {src_id}, chunk {idx}: {e}"
                print(msg)
                src_failed = True
                any_fail = True
                break

        if src_failed:
            if src_type == "document":
                await update_document_status(src_id, "failed", "Embedding failed")
            continue

        # Insert chunks into DB
        try:
            async with get_db_cursor(commit=True) as cur:
                if src_type == "document":
                    await cur.execute("DELETE FROM document_chunks WHERE document_id=%s", (src_id,))
                elif src_type == "url":
                    await cur.execute("DELETE FROM document_chunks WHERE url_id=%s", (src_id,))

                for idx, chunk in enumerate(chunks):
                    emb_literal = "[" + ",".join(map(str, embeddings[idx])) + "]"
                    await cur.execute(
                        """
                        INSERT INTO document_chunks
                            (id, document_id, url_id, organization_id, chunk_index, chunk_text, embedding, embedding_model, source_type, created_at)
                        VALUES
                            (gen_random_uuid(), %s, %s, %s, %s, %s, %s::vector, %s, %s, NOW())
                        """,
                        (
                            src_id if src_type == "document" else None,
                            src_id if src_type == "url" else None,
                            org_id,
                            idx,
                            chunk,
                            emb_literal,
                            "text-embedding-3-small",
                            src_type,
                        ),
                    )

            if src_type == "document":
                await update_document_status(src_id, "active")

            total_chunks += len(chunks)
            completed_docs += 1
            any_success = True

            await update_training_job_status(job_id, "running", total_chunks=total_chunks, completed_documents=completed_docs)

        except Exception as e:
            msg = f"[DB FAIL] Failed to insert chunks for {src_type} {src_id}: {e}"
            print(msg)
            if src_type == "document":
                await update_document_status(src_id, "failed", msg)
            any_fail = True
            continue

    # Final job status
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
        asyncio.run(update_training_job_status(job_id, "failed", str(e)))
        raise self.retry(exc=e, countdown=5)
