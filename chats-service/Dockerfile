FROM golang:1.24-alpine AS builder

# Install git and protoc
RUN apk add --no-cache git protobuf

WORKDIR /app

# Install Go protoc plugins
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Copy go files from chats-service directory (context is project root)
COPY chats-service/go.mod chats-service/go.sum ./
RUN go mod download

# Copy proto files from project root
COPY proto ./proto

# Generate Go gRPC files using your exact command
RUN protoc -I proto proto/ai_service.proto \
    --go_out=proto \
    --go-grpc_out=proto \
    --go_opt=paths=source_relative \
    --go-grpc_opt=paths=source_relative

# Copy chats-service source code
COPY chats-service/ ./

# Build the Go binary
RUN go build -o chats-service main.go

# Runtime stage
FROM alpine:latest
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/chats-service .
EXPOSE 8081
CMD ["./chats-service"]
