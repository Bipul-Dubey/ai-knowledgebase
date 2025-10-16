import asyncio
import traceback
from celery import Celery
from openai import OpenAI, APIError, RateLimitError, APIConnectionError, Timeout
from app.database.helpers import get_db_cursor
from app.helpers.file_manager import FileManager
from app.core.config import settings
import app.database.postgres_client as pg
import random

# ---------------------------
# PostgreSQL Initialization
# ---------------------------
async def init_pg():
    if pg.db is None:
        await pg.init_db()


def safe_init_pg():
    try:
        loop = asyncio.get_running_loop()
        # Already running (e.g., inside FastAPI)
        loop.create_task(init_pg())
    except RuntimeError:
        # No running loop (e.g., Celery worker)
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

# Reliable Celery settings
celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_delivery_mode="persistent",
)

# OpenAI client
client = OpenAI(api_key=settings.OPENAI_API_KEY)


# ---------------------------
# OpenAI Embedding Helper with Retry
# ---------------------------
# async def get_embedding_with_retry(text: str, retries: int = 5, base_delay: float = 1.0):
#     """
#     Fetch embedding from OpenAI API with exponential backoff + jitter.
#     """
#     for attempt in range(1, retries + 1):
#         try:
#             response = await asyncio.to_thread(
#                 client.embeddings.create,
#                 model="text-embedding-3-small",
#                 input=text[:8191],
#             )
#             return response.data[0].embedding

#         except (RateLimitError, APIConnectionError, Timeout) as e:
#             delay = base_delay * (2 ** (attempt - 1)) + (0.2 * attempt)
#             print(f"[OpenAI RETRY] attempt {attempt}/{retries}: {e}. Retrying in {delay:.2f}s...")
#             if attempt == retries:
#                 print(f"[OpenAI FAIL] giving up after {retries} attempts: {e}")
#                 raise
#             await asyncio.sleep(delay)

#         except APIError as e:
#             print(f"[OpenAI API ERROR] {e}")
#             raise

#         except Exception as e:
#             print(f"[OpenAI UNEXPECTED] {e}\n{traceback.format_exc()}")
#             raise

async def get_embedding_with_retry(text: str, retries: int = 5, base_delay: float = 1.0):
    """
    Dummy embedding generator for testing purposes.
    Returns a fixed-length list of random floats instead of calling OpenAI.
    """
    embedding_length = 1536  # match typical embedding size
    # generate a deterministic or random dummy embedding
    dummy_embedding = [random.random() for _ in range(embedding_length)]
    await asyncio.sleep(0.01)  # simulate async call
    return dummy_embedding


# ---------------------------
# Database Status Helpers
# ---------------------------
async def update_training_job_status(job_id, status, error_message=None, total_chunks=None):
    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            """
            UPDATE training_jobs
            SET status=%s,
                error_message=%s,
                total_chunks=COALESCE(%s, total_chunks),
                finished_at=NOW()
            WHERE id=%s
            """,
            (status, error_message, total_chunks, job_id)
        )


async def update_document_status(doc_id, status, error_message=None):
    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            """
            UPDATE documents
            SET status=%s,
                updated_at=NOW(),
                s3_url_expires_at=NULL
            WHERE id=%s
            """,
            (status, doc_id)
        )


# ---------------------------
# Main Training Function (Documents + URLs)
# ---------------------------
async def train_sources(job_id, org_id, user_id, document_ids=None, url_ids=None):
    total_chunks = 0
    any_success = False
    any_fail = False

    document_ids = document_ids or []
    url_ids = url_ids or []

    # Mark job as running
    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            "UPDATE training_jobs SET status='running', started_at=NOW() WHERE id=%s",
            (job_id,)
        )

    # Collect sources
    sources = []

    # ---------------------------
    # Fetch Documents
    # ---------------------------
    if document_ids:
        async with get_db_cursor() as cur:
            await cur.execute(
                "SELECT id, s3_key, file_name FROM documents WHERE organization_id=%s AND id = ANY(%s)",
                (org_id, document_ids)
            )
            docs = await cur.fetchall()
            for d in docs:
                sources.append({"id": d["id"], "type": "document", "s3_key": d["s3_key"], "file_name": d["file_name"]})

    # ---------------------------
    # Fetch URLs
    # ---------------------------
    if url_ids:
        async with get_db_cursor() as cur:
            await cur.execute(
                "SELECT id, url, title FROM urls WHERE organization_id=%s AND id = ANY(%s)",
                (org_id, url_ids)
            )
            urls = await cur.fetchall()
            for u in urls:
                sources.append({"id": u["id"], "type": "url", "url": u["url"], "title": u["title"]})

    # ---------------------------
    # Process Each Source
    # ---------------------------
    for src in sources:
        src_id = src["id"]
        src_type = src["type"]

        try:
            content = await FileManager.get_text_from_source(src)
        except Exception as e:
            print(f"[{src_type.upper()} FAIL] Download/Extract failed for {src_id}: {e}")
            if src_type == "document":
                await update_document_status(src_id, "pending")
            any_fail = True
            continue

        chunks = FileManager.chunk_text(content)
        embeddings = []
        src_failed = False

        # ---------------------------
        # Generate Embeddings
        # ---------------------------
        for idx, ch in enumerate(chunks):
            try:
                emb = await get_embedding_with_retry(ch)
                embeddings.append(emb)
            except Exception as e:
                print(f"[EMBED FAIL] {src_type} {src_id}, chunk {idx}: {e}")
                src_failed = True
                any_fail = True
                break

        if src_failed:
            if src_type == "document":
                await update_document_status(src_id, "pending")
            continue

        # ---------------------------
        # Insert Chunks into DB
        # ---------------------------
        try:
            async with get_db_cursor(commit=True) as cur:
                if src_type == "document":
                    await cur.execute("DELETE FROM document_chunks WHERE document_id=%s", (src_id,))
                elif src_type == "url":
                    await cur.execute("DELETE FROM document_chunks WHERE url_id=%s", (src_id,))

                for idx, ch in enumerate(chunks):
                    emb_literal = "[" + ",".join(map(str, embeddings[idx])) + "]"
                    await cur.execute(
                        """
                        INSERT INTO document_chunks
                        (id, document_id, url_id, organization_id, chunk_index, chunk_text, embedding, embedding_model, source_type, created_at)
                        VALUES
                        (gen_random_uuid(), %s, %s, %s, %s, %s, %s::vector, %s, %s, NOW())
                        """,
                        (src_id if src_type=="document" else None,
                         src_id if src_type=="url" else None,
                         org_id, idx, ch, emb_literal, "text-embedding-3-small", src_type)
                    )

            if src_type == "document":
                await update_document_status(src_id, "active")
            total_chunks += len(chunks)
            any_success = True
        except Exception as e:
            print(f"[DB FAIL] Failed to insert chunks for {src_type} {src_id}: {e}")
            if src_type == "document":
                await update_document_status(src_id, "pending")
            any_fail = True
            continue

    # ---------------------------
    # Final Job Status
    # ---------------------------
    if any_success and any_fail:
        final_status = "partial_failed"
    elif any_success:
        final_status = "completed"
    else:
        final_status = "failed"

    await update_training_job_status(job_id, final_status, total_chunks=total_chunks)
    print(f"🏁 Job {job_id} finished with status {final_status}, total_chunks={total_chunks}")


# ---------------------------
# Celery Task Entry
# ---------------------------
@celery_app.task(bind=True, max_retries=3)
def run_training_job(self, job_id, org_id, user_id, document_ids=None, url_ids=None):
    try:
        print(f"🚀 Starting job {job_id}")
        asyncio.run(train_sources(job_id, org_id, user_id, document_ids, url_ids))
        return f"Job {job_id} completed"
    except Exception as e:
        print(f"💥 Job {job_id} failed: {e}")
        traceback.print_exc()
        asyncio.run(update_training_job_status(job_id, "failed", str(e)))
        raise self.retry(exc=e, countdown=3)
