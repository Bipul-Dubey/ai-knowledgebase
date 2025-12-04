# ai-knowledgebase

# 🚀 Running Services Locally with Environment Variables

This project uses **environment variables** to configure services (Go, Python, Docker).  
Keep secrets (like DB password) outside the repo by using local `.env` files or passing them inline.

---

## 🌍 Common Environment Variables

| Variable        | Example Value                        | Description                               |
| --------------- | ------------------------------------ | ----------------------------------------- |
| **DB_HOST**     | `localhost` / `host.docker.internal` | Database host                             |
| **DB_PORT**     | `5432`                               | Database port                             |
| **DB_USER**     | `postgres`                           | Database username                         |
| **DB_PASSWORD** | `root`                               | Database password                         |
| **DB_NAME**     | `ai_knowledgebase`                   | Database name                             |
| **PORT**        | `8080`, `8081`, `50051`              | Service port                              |
| **GRPC_HOST**   | `ai-service:50051`                   | gRPC service host (used in chats-service) |

---

## 🖥️ Run Locally

### 1. Go Service

```bash
DB_HOST=localhost \
DB_PORT=5432 \
DB_USER=postgres \
DB_PASSWORD=root \
DB_NAME=ai_knowledgebase \
PORT=8080 \
go run main.go
```

### 2. Python Service

```bash
DB_HOST=localhost \
DB_PORT=5432 \
DB_USER=postgres \
DB_PASSWORD=root \
DB_NAME=ai_knowledgebase \
PORT=50051 \
python app.py
```

<!-- .env for golang -->

```bash
SMTP_USER=
SMTP_PASSWORD=h
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

FRONTEND_BASE_URL=http://localhost:3000
```

### Python - chats service

```bash
ENV=development
PORT=50051
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=root
DB_NAME=ai_knowledgebase

OPENAI_API_KEY=


AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=ai-knowledgebase-docs


# rabbit mq
RABBITMQ_URL=amqp://guest:guest@localhost:5672//

```
