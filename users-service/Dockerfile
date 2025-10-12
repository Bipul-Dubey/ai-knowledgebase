FROM golang:1.24-alpine AS builder

# Install git (needed for go get modules)
RUN apk add --no-cache git

# Set working directory inside container
WORKDIR /app

# Copy Go workspace files (all Go services to satisfy workspace)
COPY go.work ./
COPY shared/ ./shared/
COPY users-service/ ./users-service/

# Set working directory to users-service for build
WORKDIR /app/users-service

# Download dependencies using workspace
RUN go mod download

# Build the Go binary (workspace will resolve shared package automatically)
RUN CGO_ENABLED=0 GOOS=linux go build -o users-service main.go

# Use minimal alpine image for final runtime image
FROM alpine:latest

# Add CA certificates for HTTPS calls, if needed
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy the executable from builder stage
COPY --from=builder /app/users-service/users-service .

# Expose port 8080
EXPOSE 8080

# Run the binary
CMD ["./users-service"]
