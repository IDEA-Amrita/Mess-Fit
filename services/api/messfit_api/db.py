"""Async SQLAlchemy engines + session factories.

Two engines, matching the least-privilege role split in migration 013:

- ``engine`` / ``SessionLocal`` — the FastAPI web process. Connects as
  ``messfit_app``, which is subject to every RLS policy in the schema.
  RLS context (``request.jwt.claims``) is set per-request in
  ``auth.deps.get_current_user_id``, transaction-scoped so it can never
  leak across pooled connections into another user's request.
- ``worker_engine`` / ``WorkerSessionLocal`` — Celery tasks. Connects as
  ``messfit_worker`` (BYPASSRLS), since background jobs (the deletion
  sweep, OCR draft-dish creation) run on a schedule with no authenticated
  user in context and legitimately need cross-user access. Never used to
  serve an HTTP request.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import settings


class Base(DeclarativeBase):
    """SQLAlchemy declarative base. Every ORM model inherits from this."""


# echo=False — flip to True locally if you want to see every SQL statement
engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,  # drops dead connections quietly (Supabase pooler can recycle)
    pool_size=20,        # scale up baseline connections
    max_overflow=10,     # allow extra connections during spikes
    future=True,
)

SessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,  # rows stay usable after commit
    class_=AsyncSession,
)

worker_engine = create_async_engine(
    settings.celery_database_url or settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,          # workers run a handful of tasks concurrently, not 20
    max_overflow=5,
    future=True,
)

WorkerSessionLocal = async_sessionmaker(
    worker_engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: hand out one session per request."""
    async with SessionLocal() as session:
        yield session
