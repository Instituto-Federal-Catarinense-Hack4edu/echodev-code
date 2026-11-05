import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.api_core.exceptions import GoogleAPIError

from app.config import Settings, get_settings
from app.routes import cron, lessons, me

log = logging.getLogger("echodev")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="EchoDev API", version="0.2.0")
    if settings is not get_settings():
        app.dependency_overrides[get_settings] = lambda: settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.web_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.exception_handler(GoogleAPIError)
    async def firestore_error(_: Request, exc: GoogleAPIError) -> JSONResponse:
        # Handled inside the CORS middleware, so the browser can read the message.
        log.warning("Firestore error: %s", exc)
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
