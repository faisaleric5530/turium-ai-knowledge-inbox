"""Structured JSON logging with a per-request id bound via contextvars."""

import logging
import sys
import uuid

import structlog
from structlog.contextvars import bind_contextvars, clear_contextvars, get_contextvars


def effective_log_level(level: str, api_logging: bool) -> int:
    """Level actually used. With api_logging off, info-level API/procedure logs are
    suppressed but warnings and errors (failures) are always printed."""
    numeric_level = logging.getLevelNamesMapping().get(level.upper(), logging.INFO)
    return numeric_level if api_logging else max(numeric_level, logging.WARNING)


def configure_logging(level: str = "INFO", api_logging: bool = True) -> None:
    numeric_level = effective_log_level(level, api_logging)
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=numeric_level, force=True)
    # Our own request log replaces uvicorn's access log (which would duplicate it).
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(numeric_level),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=False,  # lets configure_logging be called again (tests)
    )


def new_request_id() -> str:
    return uuid.uuid4().hex[:12]


def bind_request_id(request_id: str) -> None:
    bind_contextvars(request_id=request_id)


def current_request_id() -> str | None:
    return get_contextvars().get("request_id")


def clear_request_context() -> None:
    clear_contextvars()
