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

settings = Settings()
