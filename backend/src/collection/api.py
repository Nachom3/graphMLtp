"""FastAPI application entry point for the v1 collection API."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .transport.api_v1 import VERSION, create_router


def create_app() -> FastAPI:
    """Create the API and register its v1 transport routes."""
    app = FastAPI(title="Waste collection (graphs + ML)", version=VERSION)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "detail": {"code": "INVALID_REQUEST", "detail": str(exc)}
            },
        )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "version": VERSION, "schema": "v1"}

    app.include_router(create_router())
    return app


app = create_app()
