FROM python:3.11-slim

WORKDIR /app

COPY chats-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY chats-service/app ./app
COPY chats-service/.env ./

EXPOSE 50051

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "50051", "--reload"]
