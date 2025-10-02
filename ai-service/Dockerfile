FROM python:3.10-slim

WORKDIR /app

# Copy requirements from ai-service directory
COPY ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy proto files from project root
COPY proto/ ./proto/

# Generate gRPC Python files
RUN python3 -m grpc_tools.protoc -I proto \
    --python_out=proto \
    --grpc_python_out=proto \
    proto/ai_service.proto

# Copy application code from ai-service directory
COPY ai-service/app/ ./app/

# Set PYTHONPATH to include proto directory
ENV PYTHONPATH="${PYTHONPATH}:/app/proto"

# Expose gRPC port
EXPOSE 50051

# Run gRPC server
CMD ["python3", "app/main.py"]
