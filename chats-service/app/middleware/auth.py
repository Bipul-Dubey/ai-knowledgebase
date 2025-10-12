import os
import jwt
import traceback
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from starlette import status
from jwt import ExpiredSignatureError, InvalidTokenError, DecodeError
from psycopg import OperationalError, InterfaceError

from app.database.helpers import get_db_cursor
from app.utils.response import APIResponse

JWT_SECRET = os.getenv("JWT_SECRET", "YOUR_SUPER_SECRET_KEY")
JWT_ALGORITHM = "HS256"


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            # 🔹 1. Validate Authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                raise HTTPException(
                    status_code=401,
                    detail="Missing or invalid Authorization header",
                )

            token_str = auth_header[7:].strip()

            # 🔹 2. Decode token safely
            try:
                claims = jwt.decode(token_str, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            except ExpiredSignatureError:
                raise HTTPException(status_code=401, detail="Token has expired")
            except DecodeError:
                raise HTTPException(status_code=401, detail="Token decoding failed")
            except InvalidTokenError:
                raise HTTPException(status_code=401, detail="Invalid token")

            # 🔹 3. Extract claims
            user_id = claims.get("user_id")
            token_version = claims.get("token_version")

            if not user_id or token_version is None:
                raise HTTPException(status_code=401, detail="Invalid token claims")

            # 🔹 4. Fetch user from DB (with safe connection handling)
            try:
                async with get_db_cursor() as cur:
                    await cur.execute(
                        """
                        SELECT id, name, email, role, status, token_version
                        FROM users
                        WHERE id = %s
                        """,
                        (user_id,),
                    )
                    user = await cur.fetchone()
            except (OperationalError, InterfaceError) as db_err:
                print("❌ Database connection error:", db_err)
                raise HTTPException(
                    status_code=503,
                    detail="Database temporarily unavailable. Please try again later.",
                )
            except Exception as db_ex:
                print("🔥 DB Query Error:", db_ex)
                traceback.print_exc()
                raise HTTPException(
                    status_code=500,
                    detail="Internal server error while verifying user.",
                )

            # 🔹 5. Validate user record
            if not user:
                raise HTTPException(status_code=401, detail="User not found")

            if user["status"] != "active":
                raise HTTPException(status_code=401, detail="User is not active")

            if user["token_version"] != token_version:
                raise HTTPException(
                    status_code=401,
                    detail="Token invalid due to password change",
                )

            # 🔹 6. Attach user info to request
            request.state.user = user
            request.state.claims = claims

            # ✅ Continue request chain
            return await call_next(request)

        except HTTPException as e:
            return JSONResponse(
                status_code=e.status_code,
                content=APIResponse(True, e.detail, None, e.status_code),
            )

        except Exception as e:
            print("🔥 Unexpected Auth Error:", e)
            traceback.print_exc()
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content=APIResponse(True, "Authentication failed", None, status.HTTP_401_UNAUTHORIZED),
            )
