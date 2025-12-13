# app/api/chats.py
from fastapi import APIRouter, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
from app.helpers.rag_graph import query_rag_openai_stream
from app.helpers.chat import create_chat
from app.utils.response import APIResponse
from app.database.postgres_client import get_db_cursor

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
        # Use the shared connection pool via get_db_cursor
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
        return APIResponse(True, f"Failed to fetch chats: {e}", None, status.HTTP_500_INTERNAL_SERVER_ERROR)

# --------------------------
# Chat Query SSE Endpoint
# --------------------------
class ChatQuerySchema(BaseModel):
    chatId: str | None = None
    message: str
    documentId: str | None = None

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
        # Send chat_id first (helps frontend initialize UI immediately)
        yield f"data: {json.dumps({'event': 'chat_id', 'chatId': str(chat_id), 'new': new_chat_created})}\n\n"
        await asyncio.sleep(0)

        try:
            async for event in query_rag_openai_stream(
                org_id=org_id,
                user_id=user_id,
                chat_id=chat_id,
                user_message=payload.message,
                document_id=payload.documentId,
            ):
                # Always send line-by-line SSE
                msg = f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                yield msg.encode("utf-8")
                await asyncio.sleep(0)
        except Exception as e:
            error_event = {"event": "error", "content": str(e)}
            yield f"data: {json.dumps(error_event)}\n\n".encode("utf-8")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering if used
        },
    )


# --------------------------
# Chat Messages Endpoint
# --------------------------
@router.get("/{chat_id}")
async def get_chat_messages(chat_id: str, request: Request):
    """
    Fetch all messages for a given chat.
    Organization ID is taken from JWT claims for multi-tenant safety.
    """
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")


    try:
        async with get_db_cursor() as cur:
            await cur.execute(
                """
                SELECT id, role, content, created_at
                FROM messages
                WHERE chat_id=%s AND organization_id=%s
                ORDER BY created_at ASC
                """,
                (chat_id, org_id)
            )
            rows = await cur.fetchall()

        return APIResponse(
            error=False,
            message="Chat messages fetched successfully",
            data={"messages": rows},
            status_code=status.HTTP_200_OK
        )

    except Exception as e:
        print(f"[CHAT MESSAGES ERROR] {e}")
        return APIResponse(
            error=True,
            message=f"Failed to fetch chat messages: {e}",
            data=None,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# --------------------------
# Delete Chat Endpoint
# --------------------------
@router.delete("/{chat_id}")
async def delete_chat(chat_id: str, request: Request):
    """
    Delete a chat and all its messages and attachments.
    Organization ID is taken from JWT claims for multi-tenant safety.
    """
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims.get("organization_id")

    try:
        # Use get_db_cursor with commit=True for automatic commit after deletion
        async with get_db_cursor(commit=True) as cur:
            # Check if chat exists and belongs to the user's org
            await cur.execute(
                "SELECT id FROM chats WHERE id=%s AND organization_id=%s",
                (chat_id, org_id)
            )
            chat = await cur.fetchone()
            if not chat:
                return APIResponse(True, "Chat not found or not authorized", None, status.HTTP_404_NOT_FOUND)

            # Delete the chat (messages & attachments will cascade)
            await cur.execute(
                "DELETE FROM chats WHERE id=%s AND organization_id=%s",
                (chat_id, org_id)
            )

        return APIResponse(False, "Chat deleted successfully", {"chat_id": chat_id}, status.HTTP_200_OK)

    except Exception as e:
        print(f"[DELETE CHAT ERROR] {e}")
        return APIResponse(
            error=True,
            message=f"Failed to delete chat: {e}",
            data=None,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
