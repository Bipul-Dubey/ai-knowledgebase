from fastapi import FastAPI
from app.database.postgres_client import init_db, close_db
from app.apis.chats import router as chats_route
from app.middleware.auth import AuthMiddleware
from app.utils.errors import register_exception_handlers

app = FastAPI(title="Chats Service")

@app.on_event("startup")
async def on_startup():
    await init_db() 

@app.on_event("shutdown")
async def on_shutdown():
    await close_db()

register_exception_handlers(app)
app.add_middleware(AuthMiddleware)
app.include_router(chats_route, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"message": "Chats Service is running"}
