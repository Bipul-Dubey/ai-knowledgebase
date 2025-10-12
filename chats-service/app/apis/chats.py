from fastapi import APIRouter, Request, status
from app.database.helpers import get_db_cursor
from app.utils.response import APIResponse
import app.database.postgres_client as pg

router = APIRouter(prefix="/chats", tags=["Chats"])

@router.get("/")
async def list_users(request: Request):
    claims = getattr(request.state, "claims", None)
    if pg.db is None:
        return APIResponse(
            True, "Database not initialized", None, status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    try:
        org_id = claims.get("organization_id")
        async with get_db_cursor() as cur:
            await cur.execute(
                """SELECT id, name, email, role, status 
                   FROM users 
                   WHERE organization_id = %s 
                   LIMIT 10""",
                (org_id,),
            )
            users = await cur.fetchall()

        return APIResponse(False, "Users fetched successfully", users, status.HTTP_200_OK)
    except Exception as e:
        return APIResponse(True, str(e), None, status.HTTP_500_INTERNAL_SERVER_ERROR)
