import re
import numpy as np
from openai import AsyncOpenAI
from app.database.postgres_client import get_db_cursor
from app.helpers.chat import save_message_to_db, fetch_recent_messages
from app.helpers.get_embedding_with_retry import get_embedding_with_retry
from app.helpers.token_usage import record_token_usage
from app.core.config import settings

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# Base RAG Configuration
TOP_K_RAG = 5
MAX_CONTEXT_MESSAGES = 10
MAX_CHUNKS_IN_PROMPT = 10
MAX_OPTIMIZE_LENGTH = 100


# Token estimation (rough, stream-safe)
def rough_token_count(text: str) -> int:
    return max(1, len(text) // 4)


# Heuristic: Should optimize query?
def should_optimize_query(message: str) -> bool:
    if len(message) > MAX_OPTIMIZE_LENGTH:
        return False

    # Code / JSON / SQL detection
    code_patterns = [
        r"{.*}", r"\[.*\]", r"SELECT .* FROM", r"def ", r"class ",
        r"```", r";", r"=>"
    ]
    if any(re.search(p, message, re.IGNORECASE | re.DOTALL) for p in code_patterns):
        return False

    # Looks like a natural question
    return True


# Query Optimization (NO DOCUMENT ACCESS)
async def optimize_user_query(user_message: str) -> str:
    system_prompt = """
You are a query optimization assistant.

Rules:
- Rewrite the query to be clear and concise.
- Preserve original intent.
- Do NOT answer the question.
- Do NOT add information.
- Output ONLY the optimized query.
"""

    user_prompt = f"""
Original Query:
{user_message}

Optimized Query:
"""

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.0,
        messages=[
            {"role": "system", "content": system_prompt.strip()},
            {"role": "user", "content": user_prompt.strip()},
        ],
    )

    return response.choices[0].message.content.strip()


# Prompt Builder (STRICT BASE RAG)
def build_rag_prompts(
    *,
    user_message: str,
    conversation_history: str | None,
    context_text: str,
) -> tuple[str, str]:

    system_prompt = """
You are a 📄 **Document-Based AI Assistant**.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 STRICT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Answer ONLY using Relevant Information.
- If information is missing, respond exactly:
  "Not found in the provided documents."
- Do NOT guess or use external knowledge.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Use headings with emojis
- Use bullet points when possible
- Bold key terms
- Clean markdown for chat UI
""".strip()

    user_prompt = f"""
📌 **User Question**
{user_message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 **Conversation History**
{conversation_history or "No prior conversation."}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 **Relevant Information**
{context_text}
""".strip()

    return system_prompt, user_prompt


# 🚀 MAIN RAG QUERY (STREAMING)
async def query_rag_openai_stream(
    org_id: str,
    user_id: str,
    chat_id: str,
    user_message: str,
    document_id: str | None = None,
):
    # Save original user message
    await save_message_to_db(org_id, chat_id, user_id, "user", user_message)
    yield {"event": "status", "content": "💬 User message saved"}

    # Query Optimization (conditional)
    optimized_message = user_message

    if should_optimize_query(user_message):
        optimized_message = await optimize_user_query(user_message)

        if optimized_message.lower() != user_message.lower():
            yield {
                "event": "optimized_query",
                "content": f"✨ Optimized: {optimized_message}",
            }

    # Embedding (use optimized query)
    query_emb = await get_embedding_with_retry(
        optimized_message,
        org_id,
        user_id,
    )
    query_emb = np.array(query_emb, dtype=float)
    query_emb_literal = "[" + ",".join(map(str, query_emb)) + "]"

    yield {"event": "status", "content": "🧠 Embedding generated"}

    # Vector Search (ORG-WIDE)
    async with get_db_cursor() as cur:
        sql = """
            SELECT
                dc.chunk_text,
                dc.document_id,
                d.file_name AS document_title
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            WHERE dc.organization_id = %s
        """
        params = [org_id]

        if document_id:
            sql += " AND dc.document_id = %s"
            params.append(document_id)

        sql += " ORDER BY dc.embedding <=> %s::vector LIMIT %s"
        params.extend([query_emb_literal, TOP_K_RAG])

        await cur.execute(sql, params)
        chunks = await cur.fetchall()

    # Sources (id + title)
    source_map = {}
    for c in chunks:
        source_map[str(c["document_id"])] = c["document_title"]

    sources = [{"id": k, "title": v} for k, v in source_map.items()]

    # Context
    context_text = "\n\n".join(
        c["chunk_text"] for c in chunks[:MAX_CHUNKS_IN_PROMPT]
    ) or "No relevant information found."

    # Conversation history
    recent = await fetch_recent_messages(chat_id, MAX_CONTEXT_MESSAGES)
    conversation_history = "\n".join(
        f"{m['role'].capitalize()}: {m['content']}" for m in recent
    )

    # Prompts
    system_prompt, user_prompt = build_rag_prompts(
        user_message=optimized_message,
        conversation_history=conversation_history,
        context_text=context_text,
    )

    prompt_tokens = rough_token_count(system_prompt) + rough_token_count(user_prompt)
    completion_tokens = 0
    full_response = ""

    # LLM Streaming
    try:
        stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            stream=True,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                token = delta.content
                full_response += token
                completion_tokens += rough_token_count(token)

                yield {
                    "event": "response",
                    "content": token,
                    "role": "assistant",
                    "chatId": chat_id,
                }


        # Save assistant message

        if full_response.strip():
            await save_message_to_db(
                org_id, chat_id, None, "assistant", full_response.strip()
            )


        # Token usage

        await record_token_usage(
            organization_id=org_id,
            user_id=user_id,
            model="gpt-4o-mini",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )


        # Final payload

        yield {
            "event": "final",
            "chatId": chat_id,
            "answer": full_response.strip(),
            "sources": sources,
        }

    except Exception as e:
        yield {"event": "error", "content": f"❌ {str(e)}"}
