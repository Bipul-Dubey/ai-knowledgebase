FROM golang:1.24-alpine AS builder

# Install git (needed for go get modules)
RUN apk add --no-cache git

# Set working directory inside container
WORKDIR /app

# Copy go.mod and go.sum files from users-service directory (context is project root)
COPY users-service/go.mod users-service/go.sum ./

# Download dependencies
RUN go mod download

# Copy source code from users-service directory
COPY users-service/ ./

# Build the Go binary
RUN go build -o users-service main.go

# Use minimal alpine image for final runtime image
FROM alpine:latest

# Add CA certificates for HTTPS calls, if needed
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy the executable from builder stage
COPY --from=builder /app/users-service .

# Expose port 8080
EXPOSE 8080

# Run the binary
CMD ["./users-service"]
