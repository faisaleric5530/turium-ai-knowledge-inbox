"""FastAPI app factory: wiring, middleware and lifespan only - no business logic."""

import re
import threading
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.embedder import Embedder
from app.adapters.llm import LlmClient
from app.adapters.url_fetcher import UrlFetcher
from app.api.routes import health, ingest, items, query
from app.config import Settings, get_settings
from app.container import build_container
from app.errors import error_response, register_exception_handlers
from app.logging_config import (
    bind_request_id,
    clear_request_context,
    configure_logging,
    new_request_id,
)

log = structlog.get_logger(__name__)
_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
# Only requests that create or change data are logged (reads such as GET /items are not).
_LOGGED_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def create_app(
    settings: Settings | None = None,
    *,
    embedder: Embedder | None = None,
    llm: LlmClient | None = None,
    fetcher: UrlFetcher | None = None,
) -> FastAPI:
    """Create the app. Tests pass fake embedder/llm/fetcher; production passes nothing."""
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.api_logging)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        container = build_container(settings, embedder=embedder, llm=llm, fetcher=fetcher)
        container.db.init()
        stranded = container.items.fail_stranded()
        if stranded:
            log.warning("stranded_items_marked_failed", count=stranded)
        app.state.container = container
        if container.embedder.status == "loading":
            # Load (and on first run download) the model without blocking startup;
            # /health reports "loading" and ingest/query return 503 until ready.
            threading.Thread(target=container.embedder.load, name="embedder-load", daemon=True).start()
        log.info(
            "app_started", llm_configured=settings.llm_configured, api_logging=settings.api_logging
        )
        yield

    app = FastAPI(
        title="Turium AI Knowledge Inbox",
        description="Save notes and URLs, then ask questions answered from them with cited sources.",
        version="0.1.0",
        lifespan=lifespan,
    )
    register_exception_handlers(app)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        supplied = request.headers.get("x-request-id", "")
        request_id = supplied if _REQUEST_ID_RE.match(supplied) else new_request_id()
        clear_request_context()
        bind_request_id(request_id)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:  # noqa: BLE001 - last-resort handler so every failure has the standard shape
            log.exception("unhandled_error", method=request.method, path=request.url.path)
            response = error_response(
                500,
                "internal_error",
                "An unexpected error occurred. Quote the request id when reporting it.",
            )
        response.headers["X-Request-ID"] = request_id
        if request.method in _LOGGED_METHODS:
            route = request.scope.get("route")
            log.info(
                "http_request",
                method=request.method,
                path=request.url.path,
                query=request.url.query or None,
                endpoint=getattr(route, "name", None),
                status=response.status_code,
                duration_ms=round((time.perf_counter() - started) * 1000, 1),
                client=request.client.host if request.client else None,
            )
        clear_request_context()
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    for router_module in (ingest, items, query, health):
        app.include_router(router_module.router)
    return app


app = create_app()
