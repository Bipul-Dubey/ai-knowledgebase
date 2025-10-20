import asyncio
from datetime import datetime
from openai import OpenAI, APIError, RateLimitError, APIConnectionError, Timeout
from app.helpers.token_usage import record_token_usage
from app.core.config import settings
import traceback

# ---------------------------
# OpenAI Client
# ---------------------------
client = OpenAI(api_key=settings.OPENAI_API_KEY)

# ---------------------------
# OpenAI Embedding Helper with Retry + Token Tracking
# ---------------------------
async def get_embedding_with_retry(text: str, org_id: str, user_id: str, doc_id: str = None, retries: int = 5, base_delay: float = 1.0):
    """
    Fetch embedding from OpenAI API with exponential backoff + jitter.
    Automatically retries on rate limit, timeout, or connection issues.
    Also logs token usage per embedding request.
    """
    for attempt in range(1, retries + 1):
        try:
            response = await asyncio.to_thread(
                client.embeddings.create,
                model="text-embedding-3-small",
                input=text[:8191],
            )

            embedding = response.data[0].embedding

            # ✅ Record token usage
            try:
                usage = getattr(response, "usage", None)
                if usage:
                    await record_token_usage(
                        organization_id=org_id,
                        user_id=user_id,
                        usage_type="embedding",
                        model=response.model,
                        document_id=doc_id,
                        prompt_tokens=usage.prompt_tokens,
                        completion_tokens=usage.completion_tokens if hasattr(usage, "completion_tokens") else 0,
                        metadata={"timestamp": datetime.utcnow().isoformat()}
                    )
            except Exception as tu_err:
                print(f"[TOKEN USAGE WARN] Failed to record token usage: {tu_err}")

            return embedding

        except (RateLimitError, APIConnectionError, Timeout) as e:
            delay = base_delay * (2 ** (attempt - 1)) + (0.2 * attempt)
            print(f"[OpenAI RETRY] Attempt {attempt}/{retries}: {e}. Retrying in {delay:.2f}s...")
            if attempt == retries:
                print(f"[OpenAI FAIL] Giving up after {retries} attempts: {e}")
                raise
            await asyncio.sleep(delay)

        except APIError as e:
            print(f"[OpenAI API ERROR] {e}")
            raise

        except Exception as e:
            print(f"[OpenAI UNEXPECTED] {e}\n{traceback.format_exc()}")
            raise

