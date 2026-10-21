import jwt
import traceback
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from jwt import ExpiredSignatureError, InvalidTokenError, DecodeError
from psycopg import OperationalError, InterfaceError

from app.core.config import settings
from app.database.postgres_client import get_db_cursor
from app.helpers.storage import LOCAL_URL_PREFIX
from app.utils.response import APIResponse

JWT_SECRET = settings.JWT_SECRET
JWT_ALGORITHM = settings.JWT_ALGORITHM

# No fallback secret. A default would be shared by every checkout, letting
# anyone who had seen the source forge tokens for any organization. It also has
# to match users-service exactly, and a silent default is precisely how the two
# services drift apart. Fail at import instead.
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is not set - refusing to start. It must match the value "
        "given to users-service. Generate one with: openssl rand -hex 48"
    )

if len(JWT_SECRET) < 32:
    raise RuntimeError(
        f"JWT_SECRET must be at least 32 characters, got {len(JWT_SECRET)} "
        "- refusing to start."
    )


# Paths that do not require a JWT:
#   /docs, /redoc, /openapi.json  developer documentation
#   /health                       liveness probe; must answer without creds
#   /api/v1/documents/local/      dev-only local file serving. Not actually
#                                 unauthenticated -- it verifies an HMAC
#                                 signature over the storage key and an expiry,
#                                 the same contract as an S3 presigned URL,
#                                 which a browser tab can follow without
#                                 sending an Authorization header.
PUBLIC_PATH_PREFIXES = (
    "/docs",
    "/redoc",
    "/openapi.json",
    "/health",
    LOCAL_URL_PREFIX,
)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # ✅ 1. Always allow preflight requests
        if request.method == "OPTIONS":
            return await call_next(request)

        # ✅ 2. Skip auth for the public prefixes
        if request.url.path.startswith(PUBLIC_PATH_PREFIXES):
            return await call_next(request)

        try:
            # 🔹 1. Validate Authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

            token_str = auth_header[7:].strip()

            # 🔹 2. Decode token safely
            try:
                claims = jwt.decode(token_str, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            except ExpiredSignatureError:
                raise HTTPException(status_code=401, detail="Token has expired")
            except (DecodeError, InvalidTokenError):
                raise HTTPException(status_code=401, detail="Invalid token")

            # 🔹 3. Extract claims
            user_id = claims.get("user_id")
            token_version = claims.get("token_version")
            if not user_id or token_version is None:
                raise HTTPException(status_code=401, detail="Invalid token claims")

            # 🔹 4. Fetch user from DB
            try:
                async with get_db_cursor() as cur:
                    await cur.execute(
                        "SELECT id, name, email, role, status, token_version FROM users WHERE id = %s",
                        (user_id,),
                    )
                    user = await cur.fetchone()
            except (OperationalError, InterfaceError) as db_err:
                print("❌ Database connection error:", db_err)
                return JSONResponse(
                    status_code=503,
                    content=APIResponse(True, "Database temporarily unavailable", None, 503),
                )
            except Exception as db_ex:
                print("🔥 DB Query Error:", db_ex)
                traceback.print_exc()
                return JSONResponse(
                    status_code=500,
                    content=APIResponse(True, "Internal server error while verifying user", None, 500),
                )

            # 🔹 5. Validate user record
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            if user["status"] != "active":
                raise HTTPException(status_code=403, detail="User is not active")
            if user["token_version"] != token_version:
                raise HTTPException(status_code=401, detail="Token invalid due to password change")

            # 🔹 6. Attach user info to request
            request.state.user = user
            request.state.claims = claims

            return await call_next(request)

        except HTTPException as e:
            return JSONResponse(
                status_code=e.status_code,
                content=APIResponse(True, e.detail, None, e.status_code),
            )

        except Exception as e:
            print("🔥 Unexpected Auth Middleware Error:", e)
            traceback.print_exc()
            return JSONResponse(
                status_code=500,
                content=APIResponse(True, "Internal server error", None, 500),
            )
