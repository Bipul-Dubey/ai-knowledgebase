from app.database.postgres_client import get_db_cursor
import uuid

# Save message and update last_message_at
async def save_message_to_db(org_id: str, chat_id: str, user_id: str, role: str, content: str):
    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            """
            INSERT INTO messages (id, chat_id, organization_id, sender_user_id, role, content, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """,
            (str(uuid.uuid4()), chat_id, org_id, user_id, role, content)
        )
        # Update chat's last_message_at
        await cur.execute(
            """
            UPDATE chats SET last_message_at=NOW() WHERE id=%s
            """,
            (chat_id,)
        )


# --------------------------
# Create New Chat
# --------------------------
async def create_chat(org_id: str, user_id: str, title: str):
    chat_id = str(uuid.uuid4())
    async with get_db_cursor(commit=True) as cur:
        await cur.execute(
            """
            INSERT INTO chats (id, organization_id, user_id, title, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'active', NOW(), NOW())
            """,
            (chat_id, org_id, user_id, title)
        )
    return chat_id, title



# --------------------------
# Fetch last N messages
# --------------------------
async def fetch_recent_messages(chat_id: str, limit: int = 20):
    async with get_db_cursor() as cur:
        await cur.execute(
            "SELECT role, content FROM messages WHERE chat_id=%s ORDER BY created_at DESC LIMIT %s",
            (chat_id, limit)
        )
        rows = await cur.fetchall()
    return list(reversed(rows))
