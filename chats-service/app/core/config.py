import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    ENV = os.getenv("ENV", "development")

    # Must be byte-identical to users-service. No default; validated in
    # app/middleware/auth.py.
    JWT_SECRET = os.getenv("JWT_SECRET")
    JWT_ALGORITHM = "HS256"
    PORT = int(os.getenv("CHAT_PORT", 50051))
    DB_TYPE = os.getenv("DB_TYPE", "postgres")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "root")
    DB_NAME = os.getenv("DB_NAME", "ai_knowledgebase")
    # Self-hosted inference only. `openai` is just the client library --
    # Ollama implements that protocol. Ollama runs on the host (containers get
    # no Metal access), so they reach it at host.docker.internal.
    LLM_BASE_URL = os.getenv("LLM_BASE_URL") or None

    # Ollama needs a non-empty token and ignores it; set for vLLM/LiteLLM.
    LLM_API_KEY = os.getenv("LLM_API_KEY") or "ollama"

    LLM_MODEL = os.getenv("LLM_MODEL", "gemma4:e4b")

    # Sent as reasoning_effort. Blank = the model's own default.
    # gemma4 thinks by default and its reasoning arrives in a field this
    # service does not forward, so those tokens are generated, discarded, and
    # paid for in latency. Valid values are per-model: see /api/show.
    LLM_REASONING_EFFORT = os.getenv("LLM_REASONING_EFFORT") or None
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "qwen3-embedding:0.6b")

    # Must match document_chunks.embedding vector(N). Checked on every call.
    EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", 1024))

    # Qwen3-Embedding is instruction-aware and asymmetric: queries take a task
    # prefix, documents take none. Blank disables it; other models differ.
    EMBEDDING_QUERY_INSTRUCTION = os.getenv(
        "EMBEDDING_QUERY_INSTRUCTION",
        "Instruct: Given a question, retrieve document passages that answer it\nQuery: ",
    )

    # Chunking. Changing either invalidates every document's index
    # fingerprint, so the next training run re-embeds rather than skipping.
    # 1000 chars is only ~150-250 words and routinely splits an explanation.
    CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 1500))
    CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 250))

    # Prepend "document > section (page N)" to each chunk before embedding.
    # A chunk from page 40 otherwise has no idea what document it belongs to,
    # which is why mid-document chunks retrieve badly. The stored chunk_text
    # stays clean -- only the embedded text carries the header.
    CONTEXTUAL_CHUNK_HEADER = os.getenv(
        "CONTEXTUAL_CHUNK_HEADER", "true"
    ).strip().lower() not in ("0", "false", "no")

    # Texts per /v1/embeddings call during training. Batching replaces one
    # HTTP round trip per chunk with one per batch.
    EMBED_BATCH_SIZE = int(os.getenv("EMBED_BATCH_SIZE", 32))

    # Retrieval: RETRIEVE_K candidates leave the vector index, the reranker
    # keeps TOP_K_RAG of them. Both floors are permissive by default and every
    # query logs its scores, so they can be tuned from real data.
    RETRIEVE_K = int(os.getenv("RETRIEVE_K", 40))
    TOP_K_RAG = int(os.getenv("TOP_K_RAG", 5))

    # Cosine distance: 0 identical, 1 orthogonal, 2 opposite.
    MAX_COSINE_DISTANCE = float(os.getenv("MAX_COSINE_DISTANCE", 1.0))

    # Blank disables reranking. Chat still works; ranking is just weaker.
    RERANK_URL = os.getenv("RERANK_URL") or None
    RERANK_TIMEOUT = float(os.getenv("RERANK_TIMEOUT", 10))
    # 0.0 = ordering only, nothing rejected. A threshold picked without
    # looking at real score distributions rejects either everything or
    # nothing; both distributions are logged per query, so raise this once
    # you have seen in-corpus and out-of-corpus questions side by side.
    MIN_RERANK_SCORE = float(os.getenv("MIN_RERANK_SCORE", 0.0))

    # Cap on chunks from any one document in the final set, so a large document
    # cannot crowd the others out of the top-K on volume alone. 0 disables.
    MAX_CHUNKS_PER_DOCUMENT = int(os.getenv("MAX_CHUNKS_PER_DOCUMENT", 2))

    # Fuse keyword search with vector search. Dense retrieval blurs exact
    # tokens -- method names, error codes, identifiers -- which is precisely
    # what BM25 is good at. Reciprocal Rank Fusion needs no score calibration
    # between the two, only their rankings.
    HYBRID_SEARCH = os.getenv("HYBRID_SEARCH", "true").strip().lower() not in (
        "0", "false", "no",
    )
    KEYWORD_K = int(os.getenv("KEYWORD_K", 20))
    RRF_K = int(os.getenv("RRF_K", 60))

    # Chunks pulled in either side of each hit. Retrieval finds the chunk that
    # matches the question; the detail that makes an answer useful is usually
    # in its neighbours. 0 disables expansion.
    CONTEXT_NEIGHBOURS = int(os.getenv("CONTEXT_NEIGHBOURS", 1))

    # AWS
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_REGION = os.getenv("AWS_REGION","ap-south-1")
    AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET")

    # Dev blob storage (see app/helpers/storage.py). Defaults work as-is;
    # LOCAL_STORAGE_DIR is the container path bind-mounted to ./local_data.
    LOCAL_STORAGE_DIR = os.getenv("LOCAL_STORAGE_DIR", "/app/local_data/documents")
    CHAT_PUBLIC_BASE_URL = os.getenv("CHAT_PUBLIC_BASE_URL", f"http://localhost:{PORT}")

    # RABBITMQ
    RABBITMQ_URL = os.getenv("RABBITMQ_URL")
    RABBITMQ_BACKEND = os.getenv("RABBITMQ_BACKEND")

    FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")
    
settings = Settings()

# Required: an OpenAI-compatible client with no base URL falls back to
# api.openai.com, which would ship documents and prompts to a hosted provider.
if not settings.LLM_BASE_URL:
    raise RuntimeError(
        "LLM_BASE_URL is not set. This service talks only to a self-hosted, "
        "OpenAI-compatible inference endpoint. Set it to "
        "http://host.docker.internal:11434/v1 from a container, or "
        "http://localhost:11434/v1 on the host."
    )
