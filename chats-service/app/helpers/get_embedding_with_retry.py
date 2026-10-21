import asyncio
from datetime import datetime
from openai import OpenAI, APIError, RateLimitError, APIConnectionError, Timeout
from app.helpers.token_usage import record_token_usage
from app.core.config import settings
import traceback

# Client for the self-hosted OpenAI-compatible endpoint (Ollama).
client = OpenAI(
    api_key=settings.LLM_API_KEY,
    base_url=settings.LLM_BASE_URL,
)

async def get_embedding_with_retry(
    text: str,
    org_id: str,
    user_id: str,
    retries: int = 5,
    base_delay: float = 1.0
) -> list[float]:
    """
    Generate embeddings with retry logic and record token usage per user/org.
    Returns: embedding vector as a list of floats.
    """
    for attempt in range(1, retries + 1):
        try:
            # The SDK's sync client blocks, so keep it off the event loop
            response = await asyncio.to_thread(
                client.embeddings.create,
                model=settings.EMBEDDING_MODEL,
                input=text[:8191],
            )

            embedding = response.data[0].embedding

            # pgvector's own error names neither the model nor the column.
            if len(embedding) != settings.EMBEDDING_DIM:
                raise ValueError(
                    f"{settings.EMBEDDING_MODEL} returned {len(embedding)} "
                    f"dimensions but EMBEDDING_DIM is {settings.EMBEDDING_DIM} "
                    f"and document_chunks.embedding is vector("
                    f"{settings.EMBEDDING_DIM}). Re-run the dimension "
                    f"migration, or correct EMBEDDING_DIM."
                )

            # Record token usage (per user/org only)
            try:
                usage = getattr(response, "usage", None)
                if usage:
                    await record_token_usage(
                        organization_id=org_id,
                        user_id=user_id,
                        model=response.model,
                        prompt_tokens=usage.prompt_tokens,
                        completion_tokens=getattr(usage, "completion_tokens", 0),
                    )
            except Exception as tu_err:
                print(f"[TOKEN USAGE WARN] Failed to record token usage: {tu_err}")

            return embedding  # ✅ Return only embedding

        except (RateLimitError, APIConnectionError, Timeout) as e:
            delay = base_delay * (2 ** (attempt - 1)) + (0.2 * attempt)
            print(f"[EMBED RETRY] Attempt {attempt}/{retries}: {e}. Retrying in {delay:.2f}s...")
            if attempt == retries:
                print(f"[EMBED FAIL] Giving up after {retries} attempts: {e}")
                raise
            await asyncio.sleep(delay)

        except APIError as e:
            print(f"[EMBED API ERROR] {e}")
            raise

        except Exception as e:
            print(f"[EMBED UNEXPECTED] {e}\n{traceback.format_exc()}")
            raise

