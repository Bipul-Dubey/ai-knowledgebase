from contextlib import asynccontextmanager
from psycopg.rows import dict_row
import app.database.postgres_client as pg

@asynccontextmanager
async def get_db_cursor(row_factory=dict_row, commit=False):
    async with pg.db.connection() as conn:
        async with conn.cursor(row_factory=row_factory) as cur:
            try:
                yield cur
                if commit:
                    await conn.commit()
            except Exception:
                await conn.rollback()
                raise
