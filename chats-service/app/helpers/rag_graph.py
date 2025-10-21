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
            base_query = """
                SELECT id, chunk_text, document_id, url_id, 
                    (embedding <=> %s::vector) AS distance
                FROM document_chunks
                WHERE organization_id = %s
            """
            params = [query_emb_literal, org_id]

            if document_id:
                base_query += " AND document_id = %s"
                params.append(document_id)
            elif url_id:
                base_query += " AND url_id = %s"
                params.append(url_id)

            base_query += " ORDER BY distance ASC LIMIT %s"
            params.append(TOP_K_RAG)

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
                "SELECT to_chunk_id FROM chunk_relations WHERE from_chunk_id=%s ORDER BY score DESC LIMIT 3",
                (chunk_id,),
            )
            related = await cur.fetchall()
            for r in related:
                queue.append((r["to_chunk_id"], depth + 1))

    # ------------------------------
    # Step 5: Prepare sources
    # ------------------------------
    context_blocks = []
    sources = []

    for idx, c in enumerate(all_chunks.values(), 1):
        if c["document_id"]:
            source_tag = f"Document #{idx} (ID: {c['document_id']})"
            sources.append({"type": "document", "id": str(c["document_id"])})
        elif c["url_id"]:
            source_tag = f"URL #{idx} (ID: {c['url_id']})"
            sources.append({"type": "url", "id": str(c["url_id"])})
        else:
            source_tag = f"Context #{idx}"

        context_blocks.append(f"### {source_tag}\n{c['chunk_text']}\n")

    # Send sources first
    yield {"event": "sources", "sources": sources, "chatId": str(chat_id)}

    # ------------------------------
    # ✅ Step 6: Optimized Prompt Construction
    # ------------------------------
    recent_messages = await fetch_recent_messages(chat_id, limit=MAX_CONTEXT_MESSAGES)

    # Conversation history formatted for context
    conversation_history = "\n".join([
        f"{m['role'].capitalize()}: {m['content']}" for m in recent_messages
    ])

    # Format retrieved chunks as labeled context
    context_text = "\n\n".join([
        f"[Context {i+1}]\n{c['chunk_text']}" for i, c in enumerate(all_chunks.values())
    ])

    # Combine everything into a structured user prompt
    user_prompt = f"""
    # 🧠 User Query
    {user_message}

    # 💬 Conversation History
    {conversation_history or 'No prior conversation.'}

    # 📚 Retrieved Context
    {context_text or 'No contextual data retrieved.'}

    ---

    Please answer the user query above using the context and conversation history.  
    If no relevant context exists, politely mention that.  
    Structure your answer clearly, conversationally, and use Markdown for formatting.
    """

    # ------------------------------
    # 🎨 Step 7: Refined System + Style Prompts
    # ------------------------------
    system_prompt = """
    You are a highly capable AI assistant integrated into a RAG (Retrieval-Augmented Generation) platform.

    Your objectives:
    1. Provide **accurate, concise, and well-structured answers** grounded in the provided context.
    2. **Do not fabricate information** beyond what is given.
    3. Respond with a **friendly, conversational tone**, like ChatGPT, but remain professional.
    4. Always answer in **Markdown format**, supporting:
    - ✅ Tables
    - ✅ Code blocks (Python, JS, etc.)
    - ✅ Lists and headings
    - ✅ Emojis (where suitable)
    5. If the context is insufficient, say so clearly and offer helpful next steps.

    When multiple documents or URLs are referenced:
    - Summarize and integrate information logically.
    - Cite sources as *(Source: Document #1, URL #2)*.
    """

    style_prompt = """
    You respond like an experienced mentor — approachable, clear, and articulate.
    Avoid robotic phrasing or repetition.
    When explaining complex ideas, break them into short, readable sections.
    End each answer with a short summary or helpful next step suggestion.
    """

    # Combine both prompts for model context
    final_system_prompt = f"{system_prompt.strip()}\n\n{style_prompt.strip()}"

    # ------------------------------
    # 🚀 Step 8: Stream OpenAI Response
    # ------------------------------
    full_response = ""
    try:
        stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": final_system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,  # slightly higher for natural phrasing
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

        # Save final message
        if full_response.strip():
            await save_message_to_db(org_id, chat_id, None, "assistant", full_response.strip())

        yield {"event": "status", "content": "✅ Answer ready!"}

    except Exception as e:
        yield {"event": "error", "content": f"❌ {str(e)}"}
