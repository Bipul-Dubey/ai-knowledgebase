from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.postgres_client import init_db, close_db
from app.apis.documents import router as documents
from app.apis.chats import router as chats
from app.middleware.auth import AuthMiddleware
from app.utils.errors import register_exception_handlers
from app.core.config import settings

app = FastAPI(title="Chats Service")

# ✅ CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_BASE_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup / Shutdown
@app.on_event("startup")
async def on_startup():
    await init_db()

@app.on_event("shutdown")
async def on_shutdown():
    await close_db()

# Error handling & auth
register_exception_handlers(app)
app.add_middleware(AuthMiddleware)

# Routers
app.include_router(documents, prefix="/api/v1")
app.include_router(chats, prefix="/api/v1")

# Health check
@app.get("/health")
async def health_check():
    return {"message": "Chats Service is running"}
