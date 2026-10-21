from app.database.postgres_client import get_db_cursor

# Per-1K-token prices. Empty: self-hosted inference has no per-token price, so
# every call costs 0.00. Kept because token_usage.total_cost is in the schema
# and the Go dashboard sums it. Token counts still accumulate.
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

class UsageAccumulator:
    """Collects token counts in memory so a job writes once instead of once
    per API call.

    The training loop otherwise upserts the same contended token_usage row
    once per chunk -- hundreds of writes to record one document.
    """

    def __init__(self, model: str):
        self.model = model
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def add(self, prompt_tokens: int = 0, completion_tokens: int = 0) -> None:
        self.prompt_tokens += prompt_tokens
        self.completion_tokens += completion_tokens

    @property
    def total(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    async def flush(self, organization_id: str, user_id: str) -> None:
        """Write the accumulated totals, then reset. No-op when empty."""
        if not self.total:
            return

        await record_token_usage(
            organization_id=organization_id,
            user_id=user_id,
            model=self.model,
            prompt_tokens=self.prompt_tokens,
            completion_tokens=self.completion_tokens,
        )
        self.prompt_tokens = 0
        self.completion_tokens = 0


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
