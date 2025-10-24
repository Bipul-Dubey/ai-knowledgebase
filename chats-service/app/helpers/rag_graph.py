
from openai import AsyncOpenAI
from app.database.postgres_client import get_db_cursor
from app.helpers.chat import save_message_to_db, fetch_recent_messages
from app.helpers.get_embedding_with_retry import get_embedding_with_retry
from app.core.config import settings
import heapq
import numpy as np

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# RAG Configuration
TOP_K_RAG = 5
MAX_GRAPH_DEPTH = 2
MAX_RELATED_CHUNKS = 3
SIMILARITY_WEIGHT = 0.7
RELATION_WEIGHT = 0.3
MAX_CONTEXT_MESSAGES = 20
MAX_CHUNKS_IN_PROMPT = 15


# -----------------------------
# 🧮 Utility: Safe similarity calc
# -----------------------------
def cosine_similarity(a, b):
    """Compute cosine similarity safely between two numpy arrays."""
    a = np.array(a, dtype=float)
    b = np.array(b, dtype=float)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))


def parse_embedding(embedding_value):
    """Convert Postgres vector or text array to numpy array of floats."""
    if isinstance(embedding_value, list):
        return np.array(embedding_value, dtype=float)
    if isinstance(embedding_value, str):
        # remove braces like "{0.1,0.2,...}" or "[" ... "]"
        embedding_value = embedding_value.strip("{}[]")
        return np.array([float(x) for x in embedding_value.split(",") if x.strip()], dtype=float)
    return np.zeros(1536, dtype=float)  # fallback


# -----------------------------
# 🚀 Main Query Function
# -----------------------------
async def query_rag_openai_stream(org_id, user_id, chat_id, user_message, document_id=None, url_id=None):
    # Step 1: Save user message
    await save_message_to_db(org_id, chat_id, user_id, "user", user_message)
    yield {"event": "status", "content": "💬 User message saved..."}

    # Step 2: Generate embedding
    query_emb = await get_embedding_with_retry(user_message, org_id, user_id)
    query_emb = np.array(query_emb, dtype=float)
    query_emb_literal = "[" + ",".join(map(str, query_emb)) + "]"
    yield {"event": "status", "content": "🧠 Embedding generated..."}

    # Step 3: Retrieve top-K chunks
    async with get_db_cursor() as cur:
        base_query = """
            SELECT id, chunk_text, document_id, url_id, embedding, (embedding <=> %s::vector) AS distance
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
        yield {"event": "status", "content": "⚠️ No relevant chunks found."}
        top_chunks = []

    # Step 4: Graph Expansion (Chunk Relations)
    all_chunks = {}
    visited = set()
    queue = []

    for tc in top_chunks:
        score = 1.0 / (tc["distance"] + 1e-6)
        heapq.heappush(queue, (-score, 0, tc["id"], tc))

    async with get_db_cursor() as cur:
        while queue and len(all_chunks) < MAX_CHUNKS_IN_PROMPT:
            neg_score, depth, chunk_id, chunk_data = heapq.heappop(queue)
            if chunk_id in visited or depth > MAX_GRAPH_DEPTH:
                continue

            visited.add(chunk_id)
            all_chunks[chunk_id] = chunk_data

            # Fetch related chunks
            await cur.execute(
                """
                SELECT to_chunk_id, score AS relation_score 
                FROM chunk_relations 
                WHERE from_chunk_id = %s
                ORDER BY score DESC LIMIT %s
                """,
                (chunk_id, MAX_RELATED_CHUNKS),
            )
            related = await cur.fetchall()

            for r in related:
                await cur.execute(
                    "SELECT id, chunk_text, document_id, url_id, embedding FROM document_chunks WHERE id=%s",
                    (r["to_chunk_id"],),
                )
                rel_chunk = await cur.fetchone()

                if rel_chunk and rel_chunk["id"] not in visited:
                    rel_emb = parse_embedding(rel_chunk["embedding"])
                    sim_score = cosine_similarity(query_emb, rel_emb)
                    combined_score = (
                        SIMILARITY_WEIGHT * sim_score + RELATION_WEIGHT * r["relation_score"]
                    )
                    heapq.heappush(queue, (-combined_score, depth + 1, rel_chunk["id"], rel_chunk))

    # Step 5: Combine top chunks as context
    context_text = "\n\n".join(
        [c["chunk_text"] for c in list(all_chunks.values())[:MAX_CHUNKS_IN_PROMPT]]
    )

    # Step 6: Fetch conversation history
    recent_messages = await fetch_recent_messages(chat_id, limit=MAX_CONTEXT_MESSAGES)
    conversation_history = "\n".join(
        [f"{m['role'].capitalize()}: {m['content']}" for m in recent_messages]
    )

    # Step 7: Build structured prompt
    user_prompt = f"""
    User Query:
    {user_message}

    Conversation History:
    {conversation_history or 'No prior conversation.'}

    Relevant Information:
    {context_text or 'No contextual data retrieved.'}

    Answer as an expert AI assistant. Make it professional, clear, structured, and visually appealing using formatting, emojis, tables, code blocks, and lists where appropriate.
    """

    # Step 8: System prompt for style & clarity
    system_prompt = """
    You are an advanced AI assistant with expertise in providing professional, clear, and actionable answers.
    Your goal is to respond like ChatGPT or Perplexity: structured, visually appealing, and easy to read.
    Use rich formatting extensively, including:

    ✅ Bullet lists for enumerations
    🔹 Numbered steps for processes
    📊 Tables for comparing data
    💻 Code blocks for code snippets, commands, or formulas
    📝 Notes for important highlights
    📌 Callouts for warnings or tips
    📈 ASCII diagrams or charts if needed
    🧠 Headings and subheadings to organize content
    🌟 Emojis to enhance readability and engagement

    Always follow these rules:
    1. Break complex ideas into short sections.
    2. Provide actionable steps or examples wherever applicable.
    3. Use consistent Markdown formatting.
    4. Avoid phrases like "as per the context" or "from the document"; integrate information naturally.
    5. Summarize key points at the end of your response.
    6. Respond in a friendly, professional, mentor-like tone.

    Always aim for clarity, completeness, and readability.
    """


    # Step 9: Stream the assistant response
    full_response = ""
    try:
        stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt.strip()},
                {"role": "user", "content": user_prompt.strip()},
            ],
            temperature=0.4,
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

        # Step 10: Save final message
        if full_response.strip():
            await save_message_to_db(org_id, chat_id, None, "assistant", full_response.strip())

        yield {"event": "status", "content": "✅ Answer ready!"}

    except Exception as e:
        yield {"event": "error", "content": f"❌ {str(e)}"}
