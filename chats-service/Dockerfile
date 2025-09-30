# Use official Golang 1.24 alpine image as build stage
FROM golang:1.24-alpine AS builder

# Install git (needed for go get modules)
RUN apk add --no-cache git

# Set working directory inside container
WORKDIR /app

# Copy go.mod and go.sum files to download dependencies
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the Go binary
RUN go build -o chats-service main.go

# Use minimal alpine image for final runtime image
FROM alpine:latest

# Add CA certificates for HTTPS calls, if needed
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy the executable from builder stage
COPY --from=builder /app/chats-service .

# Expose port 8081
EXPOSE 8081

# Run the binary
CMD ["./chats-service"]
