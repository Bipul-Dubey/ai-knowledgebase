import re
from time import perf_counter

import httpx
import numpy as np
from openai import AsyncOpenAI
from app.database.postgres_client import get_db_cursor
from app.helpers.chat import save_message_to_db, fetch_recent_messages
from app.helpers.get_embedding_with_retry import get_embedding_with_retry
from app.helpers.token_usage import record_token_usage
from app.core.config import settings

client = AsyncOpenAI(
    api_key=settings.LLM_API_KEY,
    base_url=settings.LLM_BASE_URL,
)

# Base RAG Configuration
MAX_CONTEXT_MESSAGES = 10

NOT_FOUND = "Not found in the provided documents."

# HNSW search tuning, applied per transaction.
#   ef_search      candidate list size; higher = better recall, slower
#   iterative_scan keeps scanning until LIMIT is filled on a filtered query
HNSW_EF_SEARCH = 100
HNSW_ITERATIVE_SCAN = "relaxed_order"

_pgvector_version: tuple[int, ...] | None = None


class _StageTimer:
    """Per-stage wall-clock timer for one request."""

    def __init__(self) -> None:
        self._start = perf_counter()
        self._last = self._start
        self.stages: dict[str, int] = {}

    def mark(self, stage: str) -> None:
        now = perf_counter()
        self.stages[stage] = int((now - self._last) * 1000)
        self._last = now

    def as_dict(self) -> dict[str, int]:
        return {**self.stages, "total": int((perf_counter() - self._start) * 1000)}

    def summary(self) -> str:
        return " ".join(f"{k}={v}ms" for k, v in self.as_dict().items())


_rerank_client = httpx.AsyncClient()


async def _rerank(query: str, candidates: list[dict]) -> list[dict] | None:
    """Re-order candidates by cross-encoder score, or None if unavailable.

    Fails soft on purpose: a reranker outage should weaken ranking, not break
    chat. The caller falls back to vector order.
    """
    if not settings.RERANK_URL or not candidates:
        return None

    try:
        response = await _rerank_client.post(
            f"{settings.RERANK_URL.rstrip('/')}/rerank",
            json={
                "query": query,
                "documents": [c["chunk_text"] for c in candidates],
            },
            timeout=settings.RERANK_TIMEOUT,
        )
        response.raise_for_status()
        scored = response.json()
    except Exception as exc:
        print(f"[RERANK] unavailable, using vector order: {exc}")
        return None

    ranked = []
    for item in sorted(scored, key=lambda s: s["score"], reverse=True):
        chunk = dict(candidates[item["index"]])
        chunk["score"] = item["score"]
        chunk["logit"] = item.get("logit")
        ranked.append(chunk)
    return ranked


def _spread_across_documents(ranked: list[dict], top_k: int, per_doc: int) -> list[dict]:
    """Take the best chunks without letting one document crowd out the rest.

    Ranking alone is biased by document length: a 109-chunk document fills the
    top-K of a corpus whose other documents have a handful each, so answers
    describe one document and silently ignore the others.
    """
    if per_doc <= 0:
        return ranked[:top_k]

    picked: list[dict] = []
    overflow: list[dict] = []
    counts: dict[str, int] = {}

    for chunk in ranked:
        doc = str(chunk["document_id"])
        if counts.get(doc, 0) < per_doc:
            picked.append(chunk)
            counts[doc] = counts.get(doc, 0) + 1
            if len(picked) >= top_k:
                return picked
        else:
            overflow.append(chunk)

    # Too few documents to fill top_k under the cap: backfill in score order.
    return (picked + overflow)[:top_k]


# Named placeholders throughout: this query repeats the vector and the
# question several times, and positional parameters would be a silent
# off-by-one waiting to happen.
_VECTOR_SQL = """
    SELECT dc.chunk_text,
           dc.chunk_index,
           dc.page,
           dc.section,
           dc.document_id,
           d.file_name AS document_title,
           dc.embedding <=> %(qvec)s::vector AS distance,
           NULL::bigint AS kw_rank
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.organization_id = %(org)s
      AND d.deleted_at IS NULL
      AND d.status = 'trained'
      {doc}
    ORDER BY dc.embedding <=> %(qvec)s::vector
    LIMIT %(k)s
"""

# Two independent rankings fused by Reciprocal Rank Fusion: each result
# contributes 1/(K + rank), so only positions matter and the two scoring
# scales never have to be reconciled. A chunk found by both ranks highest.
_HYBRID_SQL = """
    WITH vec AS (
        SELECT dc.id,
               ROW_NUMBER() OVER (
                   ORDER BY dc.embedding <=> %(qvec)s::vector
               ) AS rank
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.organization_id = %(org)s
          AND d.deleted_at IS NULL
          AND d.status = 'trained'
          {doc}
        ORDER BY dc.embedding <=> %(qvec)s::vector
        LIMIT %(k)s
    ),
    kw AS (
        SELECT dc.id,
               ROW_NUMBER() OVER (
                   ORDER BY ts_rank_cd(
                       dc.chunk_tsv, websearch_to_tsquery('english', %(q)s)
                   ) DESC
               ) AS rank
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.organization_id = %(org)s
          AND d.deleted_at IS NULL
          AND d.status = 'trained'
          AND dc.chunk_tsv @@ websearch_to_tsquery('english', %(q)s)
          {doc}
        LIMIT %(kw_k)s
    )
    SELECT dc.chunk_text,
           dc.chunk_index,
           dc.page,
           dc.section,
           dc.document_id,
           d.file_name AS document_title,
           dc.embedding <=> %(qvec)s::vector AS distance,
           kw.rank AS kw_rank
    FROM vec
    FULL OUTER JOIN kw ON kw.id = vec.id
    JOIN document_chunks dc ON dc.id = COALESCE(vec.id, kw.id)
    JOIN documents d ON d.id = dc.document_id
    ORDER BY COALESCE(1.0 / (%(rrf)s + vec.rank), 0)
           + COALESCE(1.0 / (%(rrf)s + kw.rank), 0) DESC
    LIMIT %(k)s
"""


def _keyword_query(text: str) -> str:
    """Rewrite a question for websearch_to_tsquery as an OR of its words.

    websearch_to_tsquery ANDs bare terms, so "how does the DOM work" demands
    every lexeme appear in the same chunk and matches almost nothing -- which
    is why the keyword side was returning zero hits. The parser treats the
    literal word "or" as |, so joining with it keeps the injection-safe parser
    while asking for any-term matches. Deciding which of those matters is what
    ranking is for.
    """
    return " or ".join(re.findall(r"\w+", text.lower()))


def _build_search_sql(
    *, org_id: str, query_text: str, query_vector: str, document_id: str | None
) -> tuple[str, dict]:
    """Candidate retrieval, hybrid or vector-only."""
    doc = "AND dc.document_id = %(doc)s" if document_id else ""
    params = {
        "org": org_id,
        "qvec": query_vector,
        "k": settings.RETRIEVE_K,
    }
    if document_id:
        params["doc"] = document_id

    if not settings.HYBRID_SEARCH:
        return _VECTOR_SQL.format(doc=doc), params

    params.update(
        q=_keyword_query(query_text),
        kw_k=settings.KEYWORD_K,
        rrf=settings.RRF_K,
    )
    return _HYBRID_SQL.format(doc=doc), params


def _chunk_label(chunk: dict) -> str:
    """Source label for one extract, so the model can cite it."""
    label = " > ".join(
        p for p in (chunk["document_title"], chunk.get("section")) if p
    )
    page = chunk.get("page")
    return f"{label}, page {page}" if page else label


async def _expand_context(org_id: str, seeds: list[dict], width: int) -> list[dict]:
    """Pull in the chunks adjacent to each hit.

    A few precise hits expanded into contiguous passages read far better than
    the same number of scattered ones, and cost the same per token.
    """
    if width <= 0 or not seeds:
        return seeds

    wanted: dict[str, set[int]] = {}
    for chunk in seeds:
        doc = str(chunk["document_id"])
        index = chunk["chunk_index"]
        wanted.setdefault(doc, set()).update(
            i for i in range(index - width, index + width + 1) if i >= 0
        )

    clauses, params = [], [org_id]
    for doc, indexes in wanted.items():
        clauses.append("(dc.document_id = %s AND dc.chunk_index = ANY(%s))")
        params.extend([doc, sorted(indexes)])

    sql = f"""
        SELECT dc.chunk_text, dc.chunk_index, dc.page, dc.section,
               dc.document_id, d.file_name AS document_title
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.organization_id = %s AND ({" OR ".join(clauses)})
    """

    async with get_db_cursor() as cur:
        await cur.execute(sql, params)
        rows = await cur.fetchall()

    # Contiguous text has to read in order. Score order interleaves passages
    # from different parts of the same document into nonsense.
    return sorted(rows, key=lambda r: (r["document_title"], r["chunk_index"]))


async def _select_chunks(
    query: str, candidates: list[dict], single_document: bool = False
) -> list[dict]:
    """Narrow the candidate set to what is actually worth sending."""
    ranked = await _rerank(query, candidates)

    if ranked is None:
        ranked = candidates

    kept = [c for c in ranked if c["score"] >= settings.MIN_RERANK_SCORE] \
        if ranked and "score" in ranked[0] else list(ranked)
    # A single-document chat has nothing to spread across.
    chosen = (
        kept[: settings.TOP_K_RAG]
        if single_document
        else _spread_across_documents(
            kept, settings.TOP_K_RAG, settings.MAX_CHUNKS_PER_DOCUMENT
        )
    )

    if ranked and "score" in ranked[0]:
        best, worst = ranked[0], ranked[-1]
        print(
            f"[RERANK] {len(ranked)} candidates | score "
            f"{worst['score']:.4f}..{best['score']:.4f} | logit "
            f"{(worst.get('logit') or 0):.2f}..{(best.get('logit') or 0):.2f} | "
            f"{len(kept)} cleared {settings.MIN_RERANK_SCORE}"
        )
    print(
        f"[RAG] sending {len(chosen)} chunks from "
        f"{len({str(c['document_id']) for c in chosen})} document(s)"
    )
    return chosen


def _completion_kwargs() -> dict:
    """Extra args for a chat completion. reasoning_effort is only sent when
    configured, because an unsupported value is a 400 rather than a no-op."""
    if settings.LLM_REASONING_EFFORT:
        return {"reasoning_effort": settings.LLM_REASONING_EFFORT}
    return {}


async def _vector_version(cur) -> tuple[int, ...]:
    """pgvector's version, resolved once.

    Read from pg_extension rather than probed by trying the settings: pgvector
    reserves the hnsw.* prefix, so SETting a name it does not know raises, and
    a raise inside the transaction would abort the search along with it.
    """
    global _pgvector_version
    if _pgvector_version is None:
        await cur.execute(
            "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
        )
        row = await cur.fetchone()
        raw = (row or {}).get("extversion") or "0"
        _pgvector_version = tuple(int(p) for p in re.findall(r"\d+", raw)[:3]) or (0,)
        iterative = "on" if _pgvector_version >= (0, 8) else "unsupported"
        print(f"[RAG] pgvector {raw} | ef_search={HNSW_EF_SEARCH} | iterative_scan={iterative}")
    return _pgvector_version


async def _apply_vector_search_settings(cur) -> None:
    """Tune HNSW for this transaction.

    iterative_scan matters because the search filters on organization_id,
    deleted_at and status *after* the index has returned its nearest
    neighbours -- without it a filtered query can come back with fewer rows
    than LIMIT, or none at all.
    """
    version = await _vector_version(cur)
    if version >= (0, 5):
        await cur.execute(f"SET LOCAL hnsw.ef_search = {HNSW_EF_SEARCH}")
    if version >= (0, 8):
        await cur.execute(
            f"SET LOCAL hnsw.iterative_scan = '{HNSW_ITERATIVE_SCAN}'"
        )


async def check_inference_ready() -> None:
    """Log the configured models and whether the endpoint actually has them.

    Catches the two cheap mistakes -- endpoint unreachable, model never
    pulled -- at startup instead of on a user's first question.
    """
    try:
        available = {m.id for m in (await client.models.list()).data}
    except Exception as exc:
        print(f"[RAG] inference endpoint unreachable at {settings.LLM_BASE_URL}: {exc}")
        return

    for label, name in (
        ("chat", settings.LLM_MODEL),
        ("embedding", settings.EMBEDDING_MODEL),
    ):
        print(f"[RAG] {label} model {name}: {'ok' if name in available else 'NOT PULLED'}")


# Token estimation (rough, stream-safe)
def rough_token_count(text: str) -> int:
    return max(1, len(text) // 4)


# Prompt Builder (STRICT BASE RAG)
def build_rag_prompts(
    *,
    user_message: str,
    conversation_history: str | None,
    context_text: str,
) -> tuple[str, str]:

    system_prompt = """
Answer strictly from the document extracts given as Context. Each extract is
preceded by its source in square brackets, as
[document > section, page N].

Grounding:
- Use only the Context. No outside knowledge, no guessing.
- If the Context does not answer the question, reply exactly:
  Not found in the provided documents.
- Never invent document names; use only the names shown in brackets.
- When the answer draws on several documents, say which said what.
- Cite the page in brackets when one is given, e.g. (javascript_tutorial.pdf,
  page 12). Never cite a page that is not shown in the Context.

Format - Markdown, rendered in a chat UI:
- Open with a direct answer in one or two sentences, with no heading above it.
- Then go into detail under short `###` headings, each starting with one
  relevant emoji. Cover everything in the Context that bears on the question,
  including specifics: names, values, parameters, steps, examples.
- `-` bullets for lists, **bold** for key terms, fenced code blocks for code,
  a table only when the data is genuinely tabular.
- Prefer completeness over brevity, but never pad: no preamble, no restating
  the question, no closing summary, no caveats about the Context.
""".strip()

    user_prompt = f"""Question
{user_message}

Conversation so far
{conversation_history or "None."}

Context
{context_text}
""".strip()

    return system_prompt, user_prompt


# 🚀 MAIN RAG QUERY (STREAMING)
async def query_rag_stream(
    org_id: str,
    user_id: str,
    chat_id: str,
    user_message: str,
    document_id: str | None = None,
):
    timer = _StageTimer()

    # Before saving this turn, or the question lands in the prompt twice.
    recent = await fetch_recent_messages(chat_id, MAX_CONTEXT_MESSAGES)
    conversation_history = "\n".join(
        f"{m['role'].capitalize()}: {m['content']}" for m in recent
    )
    timer.mark("history")

    await save_message_to_db(org_id, chat_id, user_id, "user", user_message)
    timer.mark("save_msg")
    yield {"event": "status", "content": "💬 User message saved"}

    # Embedding
    query_emb = await get_embedding_with_retry(
        user_message,
        org_id,
        user_id,
        is_query=True,
    )
    query_emb = np.array(query_emb, dtype=float)
    query_emb_literal = "[" + ",".join(map(str, query_emb)) + "]"
    timer.mark("embed")

    yield {"event": "status", "content": "🧠 Embedding generated"}

    # Vector Search (ORG-WIDE)
    async with get_db_cursor() as cur:
        await _apply_vector_search_settings(cur)

        sql, params = _build_search_sql(
            org_id=org_id,
            query_text=user_message,
            query_vector=query_emb_literal,
            document_id=document_id,
        )
        await cur.execute(sql, params)
        candidates = await cur.fetchall()

    timer.mark("search")

    # Discard what the index already considers unrelated, before paying to
    # rerank it.
    if candidates:
        distances = sorted(c["distance"] for c in candidates)
        keyword_hits = sum(1 for c in candidates if c["kw_rank"] is not None)
        print(
            f"[RAG] {len(candidates)} candidates "
            f"({keyword_hits} keyword) | cosine distance "
            f"{distances[0]:.3f}..{distances[-1]:.3f} "
            f"| floor {settings.MAX_COSINE_DISTANCE}"
        )

    # A strong keyword match is independent evidence, so the cosine floor must
    # not veto it -- that would undo hybrid retrieval for exact-token queries,
    # which is the whole reason it exists.
    near = [
        c
        for c in candidates
        if c["distance"] <= settings.MAX_COSINE_DISTANCE or c["kw_rank"] is not None
    ]
    chunks = await _select_chunks(
        user_message, near, single_document=document_id is not None
    )
    timer.mark("rerank")

    # Refuse here rather than sending empty context and trusting the model to
    # decline. A 4B-class model asked to answer only from context it has not
    # been given will usually answer anyway.
    if not chunks:
        print(
            f"[RAG] chat={chat_id} nothing cleared the relevance floor "
            f"({len(candidates)} candidates); refused without calling the LLM"
        )
        await save_message_to_db(org_id, chat_id, None, "assistant", NOT_FOUND)
        yield {
            "event": "response",
            "content": NOT_FOUND,
            "role": "assistant",
            "chatId": chat_id,
        }
        yield {
            "event": "final",
            "chatId": chat_id,
            "answer": NOT_FOUND,
            "sources": [],
            "timings": timer.as_dict(),
        }
        return

    # Context: expand each hit into a contiguous passage
    context_chunks = await _expand_context(
        org_id, chunks, settings.CONTEXT_NEIGHBOURS
    )
    timer.mark("expand")
    print(
        f"[RAG] {len(chunks)} hits expanded to {len(context_chunks)} chunks "
        f"(+/-{settings.CONTEXT_NEIGHBOURS})"
    )

    context_text = "\n\n".join(
        f"[{_chunk_label(c)}]\n{c['chunk_text']}" for c in context_chunks
    )

    # Sources, now down to the page rather than just the document.
    source_map: dict[str, dict] = {}
    for c in context_chunks:
        entry = source_map.setdefault(
            str(c["document_id"]),
            {"id": str(c["document_id"]), "title": c["document_title"], "pages": set()},
        )
        if c.get("page"):
            entry["pages"].add(c["page"])

    sources = [
        {**entry, "pages": sorted(entry["pages"])} for entry in source_map.values()
    ]

    # Prompts
    system_prompt, user_prompt = build_rag_prompts(
        user_message=user_message,
        conversation_history=conversation_history,
        context_text=context_text,
    )

    prompt_tokens = rough_token_count(system_prompt) + rough_token_count(user_prompt)
    completion_tokens = 0
    full_response = ""
    first_chunk_seen = False
    first_token_seen = False

    # LLM Streaming
    try:
        stream = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            temperature=0.2,
            stream=True,
            **_completion_kwargs(),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        async for chunk in stream:
            if not first_chunk_seen:
                first_chunk_seen = True
                # Connection, model load and prompt processing.
                timer.mark("prefill")

            # A usage-only chunk carries no choices.
            if not chunk.choices:
                continue

            delta = chunk.choices[0].delta
            if delta and delta.content:
                if not first_token_seen:
                    first_token_seen = True
                    # Gap from prefill to here is output generated but not
                    # forwarded -- i.e. the model's hidden reasoning.
                    timer.mark("ttft")

                token = delta.content
                full_response += token
                completion_tokens += rough_token_count(token)

                yield {
                    "event": "response",
                    "content": token,
                    "role": "assistant",
                    "chatId": chat_id,
                }


        timer.mark("generate")

        # Save assistant message

        if full_response.strip():
            await save_message_to_db(
                org_id, chat_id, None, "assistant", full_response.strip()
            )


        # Token usage

        await record_token_usage(
            organization_id=org_id,
            user_id=user_id,
            model=settings.LLM_MODEL,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )


        # Final payload

        timer.mark("persist")
        print(f"[RAG] chat={chat_id} {timer.summary()}")

        yield {
            "event": "final",
            "chatId": chat_id,
            "answer": full_response.strip(),
            "sources": sources,
            "timings": timer.as_dict(),
        }

    except Exception as e:
        print(f"[RAG] chat={chat_id} FAILED {timer.summary()} :: {e}")
        yield {"event": "error", "content": f"❌ {str(e)}"}
