# ai-knowledgebase

Install protoc 3.25+ from the official release page and add protoc to PATH.

Add Go plugins once (per machine):
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest.

In the Python venv install gRPC tooling:
pip install grpcio grpcio-tools.

Ensure $(go env GOPATH)/bin is on PATH so the plugins are discoverable.
export PATH="$PATH:$(go env GOPATH)/bin"

<!-- generate protoc files -->

protoc -I proto proto/ai_service.proto \
 --go_out=chats-service/proto \
 --go-grpc_out=chats-service/proto \
 --go_opt=paths=source_relative \
 --go-grpc_opt=paths=source_relative

python3 -m grpc_tools.protoc -I proto \
 --python_out=ai-service/proto \
 --grpc_python_out=ai-service/proto \
 proto/ai_service.proto

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
