from app.database.postgres_client import get_db_cursor

# Per-1K-token prices, by model.
#
# Empty, because inference is self-hosted: open-weight models on hardware we
# own have no marginal per-token price, so every call costs 0.00. The mechanism
# is kept rather than deleted for two reasons -- token_usage.total_cost is part
# of the schema and the Go dashboard sums it, and a metered self-hosted gateway
# could be priced here later.
#
# Token counts are still recorded, and still matter: when you own the hardware,
# tokens are a capacity signal rather than a billing one.
MODEL_PRICING: dict[str, dict[str, float]] = {}


def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int = 0) -> float:
    """Cost for these tokens. 0.00 for any unpriced (i.e. self-hosted) model."""
    pricing = MODEL_PRICING.get(model)
    if not pricing:
        return 0.0

    cost = (prompt_tokens / 1000) * pricing["prompt"] + (
        completion_tokens / 1000
    ) * pricing["completion"]
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
