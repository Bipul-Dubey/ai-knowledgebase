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
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "qwen3-embedding:0.6b")

    # Must match document_chunks.embedding vector(N). Checked on every call.
    EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", 1024))

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
