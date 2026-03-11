# AI Knowledgebase

This project uses **environment variables** to configure services (Go, Python, Docker, rabbitmq).  
Keep secrets (like DB password) outside the repo by using local `.env` files or passing them inline.

### ==== Environment Variable ====

```bash
#### ==================== COMMON ACROSS SERVICES ====================
ENV=development

# database config
# host.docker.internal (DB_HOST - for local DB in docker)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=root
DB_NAME=ai_knowledgebase

# email config
SMTP_USER=
SMTP_PASSWORD=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

CORS_ORIGINS=http://localhost:3000,http://localhost:8080
FRONTEND_BASE_URL=http://localhost:3000

# OPEN API
OPENAI_API_KEY=

# AWS CONFIG
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=


# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/

# PYTHON - chats service

CHAT_PORT=50051
# GO - USER SERVICE
USER_PORT=8080

# FRONTEND env
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
