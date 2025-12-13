from app.database.postgres_client import get_db_cursor

# OpenAI pricing per 1K tokens
OPENAI_PRICING = {
    "text-embedding-3-small": {"prompt": 0.00002, "completion": 0.0},
    "text-embedding-3-large": {"prompt": 0.00013, "completion": 0.0},
    "gpt-4o-mini": {"prompt": 0.00015, "completion": 0.00060},
    "gpt-4o": {"prompt": 0.005, "completion": 0.015},
}

def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int = 0) -> float:
    """Calculate total cost for given tokens and model."""
    pricing = OPENAI_PRICING.get(model, {"prompt": 0, "completion": 0})
    cost = (prompt_tokens / 1000) * pricing["prompt"] + (completion_tokens / 1000) * pricing["completion"]
    return round(cost, 6)

async def record_token_usage(
    organization_id: str,
    user_id: str,
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
):
    """
    Update cumulative token usage per organization and user.
    Uses upsert: insert if new, else increment totals.
    """
    total_cost = calculate_cost(model, prompt_tokens, completion_tokens)

    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            """
            INSERT INTO token_usage (
                organization_id, user_id,
                total_prompt_tokens, total_completion_tokens, total_cost, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (organization_id, user_id)
            DO UPDATE SET
                total_prompt_tokens = token_usage.total_prompt_tokens + EXCLUDED.total_prompt_tokens,
                total_completion_tokens = token_usage.total_completion_tokens + EXCLUDED.total_completion_tokens,
                total_cost = token_usage.total_cost + EXCLUDED.total_cost,
                updated_at = NOW()
            """,
            (
                organization_id,
                user_id,
                prompt_tokens,
                completion_tokens,
                total_cost,
            ),
        )
