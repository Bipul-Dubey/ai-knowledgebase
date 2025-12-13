from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from starlette import status
from app.utils.response import APIResponse

def register_exception_handlers(app: FastAPI):
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=APIResponse(True, str(exc), None, status.HTTP_500_INTERNAL_SERVER_ERROR)
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=APIResponse(True, exc.detail, None, exc.status_code)
        )
