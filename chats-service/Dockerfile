FROM python:3.10-slim

# Unbuffered stdout: otherwise print() is block-buffered to the docker log pipe,
# so timings and error lines appear minutes late or not at all.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY chats-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY chats-service/app ./app

EXPOSE 50051

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "50051"]
