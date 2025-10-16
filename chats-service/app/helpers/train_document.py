import asyncio
import traceback
from celery import Celery
from openai import OpenAI, APIError, RateLimitError, APIConnectionError, Timeout
from app.database.helpers import get_db_cursor
from app.helpers.file_manager import FileManager
from app.core.config import settings

import asyncio
from app.core.config import settings
import app.database.postgres_client as pg

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

celery_app = Celery(
    "train_worker",
    broker=settings.RABBITMQ_URL,
    backend=settings.RABBITMQ_BACKEND
)

client = OpenAI(api_key=settings.OPENAI_API_KEY)

# Celery reliable settings
celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_delivery_mode="persistent",
)


# -------------------
# Helper: OpenAI Embedding with Safe Backoff
# -------------------
async def get_embedding_with_retry(text: str, retries: int = 5, base_delay: float = 1.0):
    """
    Fetch embedding from OpenAI API with exponential backoff + jitter.
    """
    for attempt in range(1, retries + 1):
        try:
            response = await asyncio.to_thread(
                client.embeddings.create,
                model="text-embedding-3-small",
                input=text[:8191],
            )
            return response.data[0].embedding

        except (RateLimitError, APIConnectionError, Timeout) as e:
            # Handle known transient errors
            delay = base_delay * (2 ** (attempt - 1)) + (0.2 * attempt)
            print(f"[OpenAI RETRY] attempt {attempt}/{retries}: {e}. Retrying in {delay:.2f}s...")
            if attempt == retries:
                print(f"[OpenAI FAIL] giving up after {retries} attempts: {e}")
                raise
            await asyncio.sleep(delay)

        except APIError as e:
            print(f"[OpenAI API ERROR] {e}")
            raise

        except Exception as e:
            print(f"[OpenAI UNEXPECTED] {e}\n{traceback.format_exc()}")
            raise



# -------------------
# Helper: DB Status Updates
# -------------------
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


# -------------------
# Main Async Training Logic
# -------------------
async def train_documents(job_id, org_id, user_id, document_ids):
    total_chunks = 0
    any_success = False
    any_fail = False

    # Mark job as running
    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            "UPDATE training_jobs SET status='running', started_at=NOW() WHERE id=%s",
            (job_id,)
        )

    # Fetch documents
    async with get_db_cursor() as cur:
        await cur.execute(
            """
            SELECT id, s3_key, file_name
            FROM documents
            WHERE organization_id=%s AND id = ANY(%s)
            """,
            (org_id, document_ids)
        )
        docs = await cur.fetchall()

    for doc in docs:
        doc_id = doc["id"]
        try:
            tmp_path = await FileManager.download_to_tempfile(doc["s3_key"])
            print("[TEMP PATH]:",tmp_path)
            content = FileManager.extract_text(tmp_path)
        except Exception as e:
            print(f"[DOC FAIL] Download/Extract failed for {doc_id}: {e}")
            await update_document_status(doc_id, "pending")
            any_fail = True
            continue

        chunks = FileManager.chunk_text(content)
        embeddings = []
        doc_failed = False

        for idx, ch in enumerate(chunks):
            try:
                emb = await get_embedding_with_retry(ch)
                embeddings.append(emb)
            except Exception as e:
                print(f"[EMBED FAIL] Doc {doc_id}, chunk {idx}: {e}")
                doc_failed = True
                any_fail = True
                break

        if doc_failed:
            await update_document_status(doc_id, "pending")
            continue

        # Insert chunks
        try:
            async with get_db_cursor(commit=True) as cur:
                await cur.execute("DELETE FROM document_chunks WHERE document_id=%s", (doc_id,))
                for idx, ch in enumerate(chunks):
                    emb_literal = "[" + ",".join(map(str, embeddings[idx])) + "]"
                    await cur.execute(
                        """
                        INSERT INTO document_chunks 
                        (id, document_id, organization_id, chunk_index, chunk_text, embedding, embedding_model, created_at)
                        VALUES (gen_random_uuid(), %s, %s, %s, %s, %s::vector, %s, NOW())
                        """,
                        (doc_id, org_id, idx, ch, emb_literal, "text-embedding-3-small")
                    )
            await update_document_status(doc_id, "active")
            total_chunks += len(chunks)
            any_success = True
        except Exception as e:
            print(f"[DB FAIL] Failed to insert chunks for doc {doc_id}: {e}")
            await update_document_status(doc_id, "pending")
            any_fail = True
            continue

    # Final job status
    if any_success and any_fail:
        final_status = "partial_failed"
    elif any_success:
        final_status = "completed"
    else:
        final_status = "failed"

    await update_training_job_status(job_id, final_status, total_chunks=total_chunks)
    print(f"🏁 Job {job_id} finished with status {final_status}, total_chunks={total_chunks}")


# -------------------
# Celery Task Entry Point
# -------------------
@celery_app.task(bind=True, max_retries=3)
def run_training_job(self, job_id, org_id, user_id, document_ids):
    try:
        print(f"🚀 Starting job {job_id}")
        asyncio.run(train_documents(job_id, org_id, user_id, document_ids))
        return f"Job {job_id} completed"
    except Exception as e:
        print(f"💥 Job {job_id} failed: {e}")
        traceback.print_exc()
        asyncio.run(update_training_job_status(job_id, "failed", str(e)))
        raise self.retry(exc=e, countdown=3)
