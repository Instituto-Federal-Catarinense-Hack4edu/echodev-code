import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.routes import cron, lessons, me
from app.supabase_rest import SupabaseError

log = logging.getLogger("echodev")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # One shared async HTTP client per process (pitfall 22).
    async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0)) as client:
        app.state.http = client
        yield


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="EchoDev API", version="0.1.0", lifespan=lifespan)
    if settings is not get_settings():
        app.dependency_overrides[get_settings] = lambda: settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.web_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.exception_handler(SupabaseError)
    async def supabase_error(_: Request, exc: SupabaseError) -> JSONResponse:
        # Handled inside the CORS middleware, so the browser can read the message.
        log.warning("Supabase error: %s", exc)
        return JSONResponse(
            status_code=502, content={"detail": "Falha ao acessar o banco de dados."}
        )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(lessons.router)
    app.include_router(cron.router)
    app.include_router(me.router)
    return app


app = create_app()
