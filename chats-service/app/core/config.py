import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    ENV = os.getenv("ENV", "development")

    # Shared HMAC key, must be byte-identical to the value given to
    # users-service (Go). Intentionally has no default; validated on import
    # of app.middleware.auth so a missing value fails loudly at startup.
    JWT_SECRET = os.getenv("JWT_SECRET")
    JWT_ALGORITHM = "HS256"
    PORT = int(os.getenv("CHAT_PORT", 50051))
    DB_TYPE = os.getenv("DB_TYPE", "postgres")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "root")
    DB_NAME = os.getenv("DB_NAME", "ai_knowledgebase")
    # ===== Inference: self-hosted, open-weight models only =====
    # Embeddings and generation both run against a self-hosted
    # OpenAI-compatible endpoint, normally Ollama. There is no hosted provider
    # and no provider API key.
    #
    # The `openai` pip package remains, as the CLIENT library only -- it is the
    # wire protocol Ollama implements. It never reaches a hosted service,
    # because LLM_BASE_URL is required (validated below) and always points at
    # our own endpoint.
    #
    # Ollama runs on the HOST, never in a container: Docker Desktop on macOS
    # gives containers no Metal access, so a containerised Ollama would fall
    # back to CPU. Containers reach the host at host.docker.internal.
    LLM_BASE_URL = os.getenv("LLM_BASE_URL") or None

    # Ollama wants a non-empty bearer token and ignores its value. Overridable
    # for a self-hosted gateway (vLLM, LiteLLM) that does check it.
    LLM_API_KEY = os.getenv("LLM_API_KEY") or "ollama"

    LLM_MODEL = os.getenv("LLM_MODEL", "gemma4:e4b")
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "qwen3-embedding:0.6b")

    # Must match document_chunks.embedding's declared vector(N). Checked on
    # every embedding call, because the alternative is a pgvector insert error
    # that names neither the model nor the expected size.
    EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", 1024))

    # AWS
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_REGION = os.getenv("AWS_REGION","ap-south-1")
    AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET")

    # Blob storage -- see app/helpers/storage.py. ENV picks the backend
    # (development = local disk, anything else = S3); these only tune the
    # development one and both have working defaults, so neither needs to be
    # set. LOCAL_STORAGE_DIR is the in-container path that docker-compose
    # bind-mounts to ./local_data on the host.
    LOCAL_STORAGE_DIR = os.getenv("LOCAL_STORAGE_DIR", "/app/local_data/documents")
    CHAT_PUBLIC_BASE_URL = os.getenv("CHAT_PUBLIC_BASE_URL", f"http://localhost:{PORT}")

    # RABBITMQ
    RABBITMQ_URL = os.getenv("RABBITMQ_URL")
    RABBITMQ_BACKEND = os.getenv("RABBITMQ_BACKEND")

    FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")
    
settings = Settings()

# Required, not optional. An OpenAI-compatible client given no base URL falls
# back to api.openai.com, so a blank value here would quietly ship every
# document chunk and every prompt to a hosted provider -- the one thing this
# service must not do. Fail at import instead.
if not settings.LLM_BASE_URL:
    raise RuntimeError(
        "LLM_BASE_URL is not set. This service talks only to a self-hosted, "
        "OpenAI-compatible inference endpoint. Set it to "
        "http://host.docker.internal:11434/v1 from a container, or "
        "http://localhost:11434/v1 on the host."
    )
