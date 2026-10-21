# AI Knowledgebase

This project uses **environment variables** to configure services (Go, Python, Docker, rabbitmq).  
Keep secrets (like DB password) outside the repo by using local `.env` files or passing them inline.

## Quick start (fresh clone)

```bash
git clone <repo> && cd ai-knowledgebase

# 1. Create the two env files from their committed templates
cp .env.example .env
cp rag-frontend/.env.local.example rag-frontend/.env.local

# 2. Generate a JWT_SECRET and paste it into JWT_SECRET= in .env.
#    Required: both services refuse to start without it (min 32 chars), and
#    the value must be identical in both or every token is rejected with a 401.
openssl rand -hex 48

# 3. Nothing else is required for a development run: ENV=development keeps
#    documents on local disk and writes email to the log, and inference runs
#    on locally served open-weight models (see below).
#    For a non-development run, set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY /
#    AWS_S3_BUCKET and the SMTP_* values.

# 4. Bring the stack up. The schema is applied automatically by the
#    db-migrate service before users-service and chats-service start.
docker compose up --build
```

| What | Where |
|---|---|
| Frontend | http://localhost:3000 |
| users-service (Go) | http://localhost:8080/api/v1 |
| chats-service (Python) | http://localhost:50051/api/v1 (OpenAPI at `/docs`) |
| RabbitMQ console | http://localhost:15672 (guest / guest) |
| Postgres | `localhost:5433` from the host, `postgres:5432` inside the network |

### Development mode (`ENV=development`)

`ENV` is the only switch. Set to `development`, it replaces two backends so the
stack runs with no AWS account and no mail account.

**Email is logged, not sent.** `users-service` writes the message to its log
instead of talking to SMTP, pulling out the action links so you can click them:

```bash
docker compose logs -f users-service | grep EMAIL
```

```
[EMAIL] not sent - ENV=development
[EMAIL]   to:      you@example.com
[EMAIL]   subject: Verify Your Account
[EMAIL]   link:    http://localhost:3000/pl/verify-account?token=...&account_id=...
```

**Documents go to local disk, not S3.** `chats-service` writes to
`./local_data/documents/` on the host, bind-mounted into the container and
already gitignored. Upload, training and download all work with no AWS
credentials.

Disk has no equivalent of a presigned URL, so document links are signed with
HMAC-SHA256 over the storage key and an expiry, then served by
`GET /api/v1/documents/local/{key}`. That route is exempt from JWT auth,
because the frontend opens it as a tab navigation and a navigation cannot send
an `Authorization` header. It still verifies the signature in constant time,
enforces the expiry (which is part of the signed message, so it cannot be
extended by editing the query string), refuses any key resolving outside the
storage root, and returns 404 whenever `ENV` is not `development`.

The `celery-worker` service shares this same mount, so the worker reads back
exactly what the API wrote. Nothing needs installing on the host.

Switching backends migrates nothing — files on disk are invisible to S3, and
vice versa.

### Local models with Ollama

All inference -- embeddings and generation -- runs on open-weight models served
locally by Ollama. There is no hosted provider anywhere in this stack and no
provider API key.

The `openai` pip package is still a dependency, but purely as the client
library: it is the wire protocol Ollama implements. `LLM_BASE_URL` is required
precisely so it can never fall back to a hosted endpoint -- `chats-service`
refuses to start without it.

```bash
ollama pull qwen3-embedding:0.6b    # 639 MB, 1024-dim embeddings
ollama pull gemma4:e4b              # ~6.6 GB, generation
```

Confirm the embedding width before trusting anything downstream of it -- the
schema depends on this number:

```bash
curl -s http://localhost:11434/v1/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen3-embedding:0.6b","input":"hello"}' \
  | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["data"][0]["embedding"]))'
```

Then set `LLM_BASE_URL`, `LLM_MODEL`, `EMBEDDING_MODEL` and `EMBEDDING_DIM` in
`.env` (documented inline there).

`queries.sql` declares `embedding VECTOR(1024)` to match
`qwen3-embedding:0.6b`. Swapping to a model of a different width is **not** an
additive change, so it cannot go in `queries.sql`: it needs a one-off SQL
script that truncates `document_chunks`, alters the column, rebuilds the HNSW
index, and resets every document to `untrained` so training re-embeds it.
Forgetting that last step is the quiet failure -- documents stay `trained` with
no chunks, and every question answers "Not found in the provided documents"
with nothing in any log to explain why.

#### Ollama server settings

These configure the Ollama **host**, not this repo:

| Variable | Set to | Default | Why |
|---|---|---|---|
| `OLLAMA_CONTEXT_LENGTH` | `8192` | 4096 | the RAG prompt is ~2k tokens today and grows with retrieval width. Past the limit Ollama truncates from the **front**, which is where the grounding system prompt lives -- it looks exactly like the model ignoring its instructions. |
| `OLLAMA_KEEP_ALIVE` | `-1` | 5m | otherwise an idle gap costs a full model reload on the next question. |

`LLM_REASONING_EFFORT=none` in `.env` matters as much as either of these.
gemma4 reasons before every answer by default, and Ollama returns that
reasoning in a field this service does not forward -- so the tokens are
generated, discarded, and paid for in latency. It was 8.7s of an 18.5s request.
Check a model can disable it before setting this (`values` must include
`false`):

```bash
curl -s localhost:11434/api/show -d '{"model":"gemma4:e4b"}' | grep -A6 thinking
```

```bash
launchctl setenv OLLAMA_CONTEXT_LENGTH 8192
launchctl setenv OLLAMA_KEEP_ALIVE -1
# quit and reopen Ollama, then confirm both models stay resident:
ollama ps
```

`OLLAMA_MAX_LOADED_MODELS` defaults to 3, so the embedding and chat models
already co-exist; no change needed. `OLLAMA_NUM_PARALLEL` defaults to 1, so two
simultaneous chats queue -- fine for now, worth raising under real load.

On startup `chats-service` logs whether the endpoint is reachable and whether
each configured model is actually pulled:

```
[RAG] chat model gemma4:e4b: ok
[RAG] embedding model qwen3-embedding:0.6b: ok
[RAG] pgvector 0.8.1 | ef_search=100 | iterative_scan=on
```

Every answered query logs its stage timings. `prefill` is up to the first
stream chunk; the gap to `ttft` is output the model generated but did not
forward -- i.e. hidden reasoning, which `LLM_REASONING_EFFORT` controls:

```
[RAG] chat=<id> history=1ms save_msg=5ms embed=263ms search=7ms prefill=2974ms ttft=9827ms generate=9849ms persist=7ms total=22931ms
```

**Cost tracking is always zero.** Self-hosted inference has no per-token price,
so `token_usage.total_cost` stays at 0. Token counts still accumulate -- on your
own hardware they are a capacity signal, not a billing one.

### Schema management

`queries/queries.sql` is applied automatically on every `docker compose up` by
the one-shot `db-migrate` service, which waits for Postgres to accept
connections and then runs the file with `ON_ERROR_STOP=1`. Every statement uses
`IF NOT EXISTS`, so re-running is a no-op, and a real failure exits non-zero --
which blocks `users-service` and `chats-service` from starting against a
half-built schema.

Postgres runs the `pgvector/pgvector:pg14` image, not plain `postgres:14`: the
stock image has no `vector` extension, so `document_chunks` could never be
created.

This is a bootstrap, not a migration tool -- it only ever moves forward by
adding things. Altering or dropping an existing column still needs doing by
hand, and adopting a real migration tool (golang-migrate, Atlas, Alembic) is
the next step.

### Known gaps

1. **No real migration tool.** `queries.sql` is forward-only and additive, so
   altering or dropping an existing column needs a one-off SQL script, run by
   hand. Adopting golang-migrate, Atlas or Alembic is the next step.

### ==== Environment Variable ====

**`.env.example` is the authoritative list.** It is committed, and every
variable the code actually reads is in it with notes on why. `.env` is
gitignored and is what the services load (`env_file:` in docker-compose).

Values below are the Docker Compose defaults. Running a service directly on the
host instead? Use `DB_HOST=localhost` with `DB_PORT=5433`, and
`RABBITMQ_URL=amqp://guest:guest@localhost:5672/`.

```bash
# ==================== COMMON ACROSS SERVICES ====================
ENV=development

# database  (DB_HOST is the compose SERVICE NAME, not localhost - a container
#            resolving "localhost" reaches itself, not postgres)
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=root
DB_NAME=ai_knowledgebase
DB_SSL_MODE=disable       # Go only; required for a managed/remote Postgres
DB_TYPE=postgres          # Python only; informational

# auth  (REQUIRED, min 32 chars, IDENTICAL for both services, else every
#        users-service token is rejected by chats-service with a 401.
#        Generate/rotate with: openssl rand -hex 48)
JWT_SECRET=

# email config
SMTP_USER=
SMTP_PASSWORD=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# CORS_ORIGINS is read by Go only. chats-service ignores it and allows
# exactly one origin: FRONTEND_BASE_URL.
CORS_ORIGINS=http://localhost:3000,http://localhost:8080
FRONTEND_BASE_URL=http://localhost:3000

# AWS CONFIG
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
RABBITMQ_BACKEND=rpc://   # Celery result backend; may be blank (job status
                          # lives in the training_jobs table)

# PYTHON - chats service
CHAT_PORT=50051
# GO - USER SERVICE
USER_PORT=8080

# FRONTEND
# Inlined into the client bundle at BUILD time, so compose passes them as
# build args (see docker-compose.yml). Setting them only at runtime has no
# effect. Local `npm run dev` reads rag-frontend/.env.local instead.
NEXT_PUBLIC_API_BASE=http://localhost:8080/api/v1
NEXT_PUBLIC_API_BASE_CHAT=http://localhost:50051/api/v1
```

### ==== Python to run on local ====

```bash
# Create a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install all dependencies

pip install -r requirements.txt

# Run the app

uvicorn app.main:app --reload --port 50051

pip freeze > requirements.txt

<!-- CELERY  -->

#### LOGS CHECK

celery -A app.helpers.train_document worker --loglevel=info

```

```bash
# see inside docker services
docker exec -it users-service-1 sh

# into database
docker exec -it postgres-db psql -U postgres -d ai_knowledgebase

# see logs
docker compose logs -f frontend-service
```
