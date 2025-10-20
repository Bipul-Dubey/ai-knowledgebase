from openai import AsyncOpenAI
from app.database.helpers import get_db_cursor
from app.helpers.chat import save_message_to_db, fetch_recent_messages
from app.helpers.get_embedding_with_retry import get_embedding_with_retry
from app.core.config import settings

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# ------------------------------
# Configurable constants
# ------------------------------
TOP_K_RAG = 5
MAX_GRAPH_DEPTH = 2
MAX_CONTEXT_MESSAGES = 20


async def query_rag_openai_stream(
    org_id,
    user_id,
    chat_id,
    user_message,
    document_id: str = None,
    url_id: str = None
):
    """
    RAG + Streaming OpenAI Response
    Supports formatted responses: tables, code blocks, graphs, HTML snippets, emojis
    Sends sources first, then AI response.
    """

    # ------------------------------
    # Step 1: Save user message
    # ------------------------------
    await save_message_to_db(org_id, chat_id, user_id, "user", user_message)
    yield {"event": "status", "content": "💬 User message saved..."}

    # ------------------------------
    # Step 2: Generate embedding
    # ------------------------------
    query_emb = await get_embedding_with_retry(user_message, org_id, user_id)
    query_emb_literal = "[" + ",".join(map(str, query_emb)) + "]"
    yield {"event": "status", "content": "🧠 Embedding generated..."}

    # ------------------------------
    # Step 3: Retrieve relevant chunks
    # ------------------------------
    async with get_db_cursor() as cur:
        base_query = "SELECT id, chunk_text, document_id, url_id FROM document_chunks WHERE organization_id=%s"
        params = [org_id]
        if document_id:
            base_query += " AND document_id=%s"
            params.append(document_id)
        elif url_id:
            base_query += " AND url_id=%s"
            params.append(url_id)
        base_query += " ORDER BY embedding <#> %s::vector LIMIT %s"
        params.extend([query_emb_literal, TOP_K_RAG])

        await cur.execute(base_query, params)
        top_chunks = await cur.fetchall()

    if not top_chunks:
        yield {"event": "status", "content": "⚠️ No related context found."}
        top_chunks = []

    # ------------------------------
    # Step 4: BFS expand chunks via chunk_relations
    # ------------------------------
    all_chunks = {}
    queue = [(tc["id"], 0) for tc in top_chunks]
    visited = set()

    async with get_db_cursor() as cur:
        while queue:
            chunk_id, depth = queue.pop(0)
            if chunk_id in visited or depth > MAX_GRAPH_DEPTH:
                continue
            visited.add(chunk_id)

            await cur.execute(
                "SELECT id, chunk_text, document_id, url_id FROM document_chunks WHERE id=%s",
                (chunk_id,),
            )
            row = await cur.fetchone()
            if row:
                all_chunks[chunk_id] = row

            await cur.execute(
                "SELECT to_chunk_id FROM chunk_relations WHERE from_chunk_id=%s ORDER BY score DESC",
                (chunk_id,),
            )
            related = await cur.fetchall()
            for r in related:
                queue.append((r["to_chunk_id"], depth + 1))

    # ------------------------------
    # Step 5: Prepare sources
    # ------------------------------
    sources = []
    for c in all_chunks.values():
        if c["document_id"]:
            sources.append({"type": "document", "id": str(c["document_id"])})
        elif c["url_id"]:
            sources.append({"type": "url", "url": c["url_id"]})

    # Send sources first
    yield {"event": "sources", "sources": sources, "chatId": str(chat_id)}

    # ------------------------------
    # Step 6: Prepare prompt
    # ------------------------------
    recent_messages = await fetch_recent_messages(chat_id, limit=MAX_CONTEXT_MESSAGES)
    prompt_parts = [f"{m['role'].capitalize()}: {m['content']}" for m in recent_messages]
    if all_chunks:
        prompt_parts.append("\n# Context from related documents/URLs:\n")
        prompt_parts.append("\n\n".join([c["chunk_text"] for c in all_chunks.values()]))
    prompt_parts.append(f"\nUser query:\n{user_message}")
    full_prompt = "\n".join(prompt_parts)

    # Rich system prompt for formatting
    system_prompt = (
        "You are a highly intelligent AI assistant. Answer queries using the provided context.\n"
        "Your responses MUST be in Markdown format and may include:\n"
        "- Tables\n"
        "- Code blocks (Python, JS, etc.)\n"
        "- Emojis\n"
        "- HTML snippets\n"
        "- ASCII/Markdown graphs\n\n"
        "Always give a clear, structured, and concise answer.\n"
        "Do NOT include images, audio, or video."
    )

    # ------------------------------
    # Step 7: Stream AI response
    # ------------------------------
    full_response = ""
    try:
        stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": full_prompt},
            ],
            temperature=0.2,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                token = delta.content
                full_response += token
                yield {
                    "event": "response",
                    "content": token,
                    "role": "assistant",
                    "chatId": str(chat_id),
                }

        # Save final answer
        if full_response.strip():
            await save_message_to_db(org_id, chat_id, None, "assistant", full_response.strip())

        yield {"event": "status", "content": "✅ Answer ready!"}

    except Exception as e:
        yield {"event": "error", "content": f"❌ {str(e)}"}
