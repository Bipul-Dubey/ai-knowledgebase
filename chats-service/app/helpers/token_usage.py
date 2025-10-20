import json
from typing import Optional, Dict, Any
from app.database.helpers import get_db_cursor

# Cost mapping based on OpenAI pricing (as of Oct 2025)
OPENAI_PRICING = {
    "text-embedding-3-small": {"prompt": 0.00002, "completion": 0.0},
    "text-embedding-3-large": {"prompt": 0.00013, "completion": 0.0},
    "gpt-4o-mini": {"prompt": 0.00015, "completion": 0.00060},
    "gpt-4o": {"prompt": 0.005, "completion": 0.015},
}

def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int = 0) -> float:
    pricing = OPENAI_PRICING.get(model, {"prompt": 0, "completion": 0})
    cost = (prompt_tokens / 1000) * pricing["prompt"] + (completion_tokens / 1000) * pricing["completion"]
    return round(cost, 6)

async def record_token_usage(
    organization_id: str,
    usage_type: str,
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    user_id: Optional[str] = None,
    chat_id: Optional[str] = None,
    document_id: Optional[str] = None,
    query_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
):
    cost = calculate_cost(model, prompt_tokens, completion_tokens)
    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            """
            INSERT INTO token_usage (
                organization_id,
                user_id,
                chat_id,
                document_id,
                query_id,
                usage_type,
                model,
                prompt_tokens,
                completion_tokens,
                cost,
                metadata
            )
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                organization_id,
                user_id,
                chat_id,
                document_id,
                query_id,
                usage_type,
                model,
                prompt_tokens,
                completion_tokens,
                cost,
                json.dumps(metadata or {}),
            ),
        )
