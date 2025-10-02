FROM golang:1.24-alpine AS builder

# Install git and protoc
RUN apk add --no-cache git protobuf

WORKDIR /app

# Install Go protoc plugins
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Copy Go workspace files (all Go services to satisfy workspace)
COPY go.work ./
COPY shared/ ./shared/
COPY chats-service/ ./chats-service/
COPY users-service/ ./users-service/

# Copy proto files from project root
COPY proto/ ./proto/

# Generate Go gRPC files in the chats-service directory
RUN mkdir -p chats-service/proto
RUN protoc -I proto proto/ai_service.proto \
    --go_out=chats-service/proto \
    --go-grpc_out=chats-service/proto \
    --go_opt=paths=source_relative \
    --go-grpc_opt=paths=source_relative

# Build the chats-service binary
WORKDIR /app/chats-service
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o chats-service main.go

# Runtime stage
FROM alpine:latest
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/chats-service/chats-service .
EXPOSE 8081
CMD ["./chats-service"]
