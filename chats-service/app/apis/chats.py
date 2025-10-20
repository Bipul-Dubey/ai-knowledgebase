# app/api/chats.py
from fastapi import APIRouter, Request, status, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
from app.helpers.rag_graph import query_rag_openai_stream
from app.helpers.chat import create_chat
from app.utils.response import APIResponse
from app.database.helpers import get_db_cursor

router = APIRouter(prefix="/chats", tags=["chats"])

# --------------------------
# List chats
# --------------------------
class ChatListResponse(BaseModel):
    id: str
    title: str
    last_message_at: Optional[str]

@router.get("/list")
async def get_chats_list(request: Request):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")
    user_id = claims.get("user_id")
    try:
        async with get_db_cursor() as cur:
            await cur.execute(
                """
                SELECT id, title, last_message_at
                FROM chats
                WHERE organization_id = %s AND status = 'active' AND user_id = %s
                ORDER BY last_message_at DESC NULLS LAST, created_at DESC
                """,
                (org_id, user_id)
            )
            rows = await cur.fetchall()
            chat_list = [
                {"id": r["id"], "title": r["title"], "last_message_at": r["last_message_at"]}
                for r in rows
            ]
            return APIResponse(False, "Chats fetched successfully", chat_list)
    except Exception as e:
        print(f"[CHAT LIST ERROR] {e}")
        return APIResponse(True, f"Failed to fetch chats: {e}", None, 500)

# --------------------------
# Chat Query SSE Endpoint
# --------------------------
class ChatQuerySchema(BaseModel):
    chatId: str | None = None  # Optional: existing chat
    message: str
    documentId: str | None = None
    urlId: str | None = None

@router.post("/query")
async def chat_query_sse(payload: ChatQuerySchema, request: Request):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return {"error": "Unauthorized"}, status.HTTP_401_UNAUTHORIZED

    org_id = claims.get("organization_id")
    user_id = claims.get("user_id")
    chat_id = payload.chatId

    # ✅ If chatId is not provided, create a new chat
    if not chat_id:
        chat_id, _ = await create_chat(org_id, user_id, title=payload.message[:50])
        new_chat_created = True
    else:
        new_chat_created = False

    async def event_generator():
        # First event: send chatId to frontend
        yield f"data: {json.dumps({'event': 'chat_id', 'chatId': str(chat_id), 'new': new_chat_created})}\n\n"

        try:
            # Stream RAG + OpenAI response
            async for event in query_rag_openai_stream(
                org_id=org_id,
                user_id=user_id,
                chat_id=chat_id,
                user_message=payload.message,
                document_id=payload.documentId,
                url_id=payload.urlId,
            ):
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0.01)
        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# --------------------------
# Chat Meesages Endpoint
# --------------------------
@router.get("/{chat_id}")
async def get_chat_messages(chat_id: str, request: Request):
    """
    Fetch all messages for a given chat.
    Organization ID and user ID are taken from JWT claims for multi-tenant safety.
    """
    claims = getattr(request.state, "claims", None)
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized"
        )

    org_id = claims.get("organization_id")

    async with get_db_cursor() as cur:
        await cur.execute(
            """
            SELECT id, role, content, created_at
            FROM messages
            WHERE chat_id=%s AND organization_id=%s
            ORDER BY created_at ASC
            """,
            (chat_id, org_id),
        )
        rows = await cur.fetchall()

    return APIResponse(
        error=False,
        message="Chat messages fetched successfully",
        data={"messages": rows},
    )