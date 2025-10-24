import os
import asyncio
from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row
from contextlib import asynccontextmanager

db: AsyncConnectionPool | None = None
_db_lock = asyncio.Lock()

async def init_db(retries: int = 5, delay: int = 2):
    """
    Initialize PostgreSQL async pool safely.
    Avoid opening the pool in the constructor (prevents psycopg warning).
    """
    global db
    async with _db_lock:
        if db and not db.closed:
            return  # already initialized

        conn_str = (
            f"dbname={os.getenv('DB_NAME', 'ai_knowledgebase')} "
            f"user={os.getenv('DB_USER', 'postgres')} "
            f"password={os.getenv('DB_PASSWORD', 'root')} "
            f"host={os.getenv('DB_HOST', 'localhost')} "
            f"port={os.getenv('DB_PORT', '5432')}"
        )

        for attempt in range(retries):
            try:
                # Create pool but DO NOT auto-open it
                pool = AsyncConnectionPool(conn_str, min_size=1, max_size=20)
                await pool.open()  # explicitly open the pool

                # Test connection
                async with pool.connection() as conn:
                    await conn.execute("SELECT 1")

                db = pool
                print("✅ DB pool initialized")
                return
            except Exception as e:
                print(f"❌ DB init attempt {attempt+1} failed: {e}")
                await asyncio.sleep(delay)

        raise RuntimeError("Failed to initialize DB after retries")


async def close_db():
    """Close PostgreSQL pool gracefully."""
    global db
    if db:
        await db.close()
        db = None
        print("🔒 DB pool closed")


@asynccontextmanager
async def get_db_cursor(row_factory=dict_row, commit=False):
    """Get cursor from global db pool with auto-commit/rollback."""
    if db is None:
        raise RuntimeError("DB pool not initialized")

    async with db.connection() as conn:
        async with conn.cursor(row_factory=row_factory) as cur:
            try:
                yield cur
                if commit:
                    await conn.commit()
            except Exception:
                await conn.rollback()
                raise
