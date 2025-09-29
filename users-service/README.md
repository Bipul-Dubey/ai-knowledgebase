# Go Microservice

This is a Go microservice that exposes APIs using **Gin framework**. It can be run locally or inside a Docker container.

---

## Prerequisites

- Go 1.24+ (or your target Go version)
- Git (for cloning the repository)
- Docker (if running via Docker)

---

## Running Locally

- Clone the repository:
```
git clone <your-repo-url>
cd <your-repo-folder>
```

- Download dependencies:
```
go mod tidy
```

- Run the service:
```
go run main.go
```

## Running With Docker

- Build the Docker image:
```
docker build -t users-service .
```

- Run the Docker container:
```
docker run -p 8000:8000 users-service
```

- Access the API:
- Visit [http://localhost:8000](http://localhost:8000) in your browser
