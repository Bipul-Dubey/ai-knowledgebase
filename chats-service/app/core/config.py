import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    ENV = os.getenv("ENV", "development")
    PORT = int(os.getenv("PORT", 50051))
    DB_TYPE = os.getenv("DB_TYPE", "postgres")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "root")
    DB_NAME = os.getenv("DB_NAME", "ai_knowledgebase")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY","OPENAI_API_KEY")

    # AWS
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_REGION = os.getenv("AWS_REGION","ap-south-1")
    AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET")

    # RABBITMQ
    RABBITMQ_URL = os.getenv("RABBITMQ_URL")
    RABBITMQ_BACKEND = os.getenv("RABBITMQ_BACKEND")
    
settings = Settings()
