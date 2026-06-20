"""Centralized structured logging configuration.

Configures ``structlog`` as the *single* logging library across the entire
application. All modules must use ``structlog.get_logger()`` instead of
``logging.getLogger()``.

Design choices
--------------
* **JSON in production, pretty-print in dev** — controlled by ``environment``.
* **Request-ID correlation** — a ``request_id`` field is bound in ASGI
  middleware so every log line within a request shares the same correlation ID.
* **stdlib bridge** — third-party libraries (SQLAlchemy, uvicorn) that use
  ``logging`` are routed through structlog's processors, so all output is
  consistently formatted.
"""

from __future__ import annotations

import logging
import sys
from typing import Any

import structlog

from .config import settings


def configure_logging() -> None:
    """Call once at startup (before the app processes any requests)."""

    is_dev = settings.environment == "development"

    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if is_dev:
        # Pretty, coloured console output for local development.
        renderer: Any = structlog.dev.ConsoleRenderer()
    else:
        # Machine-readable JSON for production log aggregation (ELK / Loki).
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
        foreign_pre_chain=shared_processors,
    )

    root = logging.getLogger()
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    # Quiet noisy libraries.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
