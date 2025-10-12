import os
import sys
import asyncio
from psycopg_pool import AsyncConnectionPool

db: AsyncConnectionPool | None = None  # Global connection pool

async def init_db(retries: int = 5, delay: int = 2):
    """
    Initialize Async PostgreSQL connection pool with retry logic.
    Explicitly open the pool after instantiating to follow psycopg best practices.
    """
    global db
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "root")
    db_name = os.getenv("DB_NAME", "ai_knowledgebase")

    conn_str = f"dbname={db_name} user={db_user} password={db_password} host={db_host} port={db_port}"

    for attempt in range(1, retries + 1):
        try:
            db = AsyncConnectionPool(conn_str, min_size=1, max_size=10)
            await db.open() 
            # Test connection
            async with db.connection() as conn:
                await conn.execute("SELECT 1")
            print("✅ Async database pool initialized successfully")
            return
        except Exception as e:
            print(f"❌ Attempt {attempt}: Failed to connect to DB: {e}")
            if attempt < retries:
                await asyncio.sleep(delay)
            else:
                sys.exit(1)

async def close_db():
    """Cleanly close the async PostgreSQL connection pool."""
    global db
    if db:
        await db.close()
        print("🔒 Async database connections closed")
