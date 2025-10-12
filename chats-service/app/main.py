from fastapi import FastAPI
from app.database.postgres_client import init_db, close_db
from app.apis.chats import router as chats_route
from app.apis.documents import router as documents
from app.middleware.auth import AuthMiddleware
from app.utils.errors import register_exception_handlers
from app.helpers.local_embeddings import init_embeddings_system

app = FastAPI(title="Chats Service")

@app.on_event("startup")
async def on_startup():
    await init_db() 
    init_embeddings_system()

@app.on_event("shutdown")
async def on_shutdown():
    await close_db()

register_exception_handlers(app)
app.add_middleware(AuthMiddleware)
app.include_router(chats_route, prefix="/api/v1")
app.include_router(documents, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"message": "Chats Service is running"}
