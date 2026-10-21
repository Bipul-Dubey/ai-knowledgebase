import asyncio
import traceback

from openai import OpenAI, APIError, RateLimitError, APIConnectionError, Timeout

from app.core.config import settings
from app.helpers.token_usage import UsageAccumulator, record_token_usage

# Client for the self-hosted OpenAI-compatible endpoint (Ollama).
client = OpenAI(
    api_key=settings.LLM_API_KEY,
    base_url=settings.LLM_BASE_URL,
)


def _prepare(text: str, is_query: bool) -> str:
    """Apply the model's task prefix, for queries only.

    Qwen3-Embedding is asymmetric by design; prefixing documents too would
    cancel out the asymmetry the prefix exists to create.
    """
    if is_query and settings.EMBEDDING_QUERY_INSTRUCTION:
        return f"{settings.EMBEDDING_QUERY_INSTRUCTION}{text}"[:8191]
    return text[:8191]


async def _embed_batch(
    payloads: list[str],
    org_id: str,
    user_id: str,
    usage: UsageAccumulator | None,
    retries: int,
    base_delay: float,
) -> list[list[float]]:
    for attempt in range(1, retries + 1):
        try:
            # The SDK's sync client blocks, so keep it off the event loop.
            response = await asyncio.to_thread(
                client.embeddings.create,
                model=settings.EMBEDDING_MODEL,
                input=payloads,
            )

            # The API does not promise input order, so sort by index.
            vectors = [
                item.embedding
                for item in sorted(response.data, key=lambda d: d.index)
            ]

            if len(vectors) != len(payloads):
                raise ValueError(
                    f"{settings.EMBEDDING_MODEL} returned {len(vectors)} "
                    f"embeddings for {len(payloads)} inputs"
                )

            # pgvector's own error names neither the model nor the column.
            for vector in vectors:
                if len(vector) != settings.EMBEDDING_DIM:
                    raise ValueError(
                        f"{settings.EMBEDDING_MODEL} returned {len(vector)} "
                        f"dimensions but EMBEDDING_DIM is "
                        f"{settings.EMBEDDING_DIM} and "
                        f"document_chunks.embedding is vector("
                        f"{settings.EMBEDDING_DIM}). Re-embed, or correct "
                        f"EMBEDDING_DIM."
                    )

            try:
                reported = getattr(response, "usage", None)
                if reported:
                    prompt = reported.prompt_tokens
                    completion = getattr(reported, "completion_tokens", 0)
                    if usage is not None:
                        # Held in memory; the caller writes once per job.
                        usage.add(prompt, completion)
                    else:
                        await record_token_usage(
                            organization_id=org_id,
                            user_id=user_id,
                            model=response.model,
                            prompt_tokens=prompt,
                            completion_tokens=completion,
                        )
            except Exception as exc:
                print(f"[TOKEN USAGE WARN] not recorded: {exc}")

            return vectors

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

    raise RuntimeError("unreachable: retry loop exhausted without raising")


async def embed_texts(
    texts: list[str],
    org_id: str,
    user_id: str,
    *,
    is_query: bool = False,
    usage: UsageAccumulator | None = None,
    retries: int = 5,
    base_delay: float = 1.0,
) -> list[list[float]]:
    """Embed many texts, in batches.

    /v1/embeddings accepts an array, so batching replaces one HTTP round trip
    per chunk with one per batch -- and lets the server batch the forward pass
    rather than running it once per text.
    """
    if not texts:
        return []

    size = max(1, settings.EMBED_BATCH_SIZE)
    vectors: list[list[float]] = []

    for start in range(0, len(texts), size):
        batch = [_prepare(t, is_query) for t in texts[start : start + size]]
        vectors.extend(
            await _embed_batch(batch, org_id, user_id, usage, retries, base_delay)
        )

    return vectors


async def get_embedding_with_retry(
    text: str,
    org_id: str,
    user_id: str,
    retries: int = 5,
    base_delay: float = 1.0,
    is_query: bool = False,
) -> list[float]:
    """Embed a single text. Thin wrapper over embed_texts."""
    vectors = await embed_texts(
        [text],
        org_id,
        user_id,
        is_query=is_query,
        retries=retries,
        base_delay=base_delay,
    )
    return vectors[0]
