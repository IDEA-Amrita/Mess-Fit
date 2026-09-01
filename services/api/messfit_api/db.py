"""Async SQLAlchemy engines + session factories.

Two engines, matching the least-privilege role split in migration 013:

- ``engine`` / ``SessionLocal`` — the FastAPI web process. Connects as
  ``messfit_app``, which is subject to every RLS policy in the schema.
  RLS context (``request.jwt.claims``) is set per-request in
  ``auth.deps.get_current_user_id`` via ``set_config(..., false)``
  (session-scoped, not transaction-scoped — see that function's
  docstring for why). ``get_session`` resets it before the connection
  returns to the pool, so it still can't leak into a later request that
  reuses the same physical connection.
- ``worker_engine`` / ``WorkerSessionLocal`` — Celery tasks. Connects as
  ``messfit_worker`` (BYPASSRLS), since background jobs (the deletion
  sweep, OCR draft-dish creation) run on a schedule with no authenticated
  user in context and legitimately need cross-user access. Never used to
  serve an HTTP request, and never sets request.jwt.claims at all.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
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


@asynccontextmanager
async def _pinned_session() -> AsyncIterator[AsyncSession]:
    """One physical connection for the whole scope, not just the Engine.

    A Session bound to an Engine (the SQLAlchemy default) releases its
    underlying connection back to the pool at the end of every transaction
    — i.e. after every commit() — and the next query checks out whichever
    connection the pool hands it next, possibly a different one. Since
    this codebase's dominant handler shape is commit() immediately
    followed by another query (refresh(), or a fallback SELECT after an
    ON CONFLICT DO NOTHING), that meant request.jwt.claims — a
    session-scoped Postgres setting, tied to the physical connection, not
    the SQLAlchemy Session object — routinely applied to one connection
    and then silently stopped applying for the rest of the same request,
    with RLS then seeing no identity at all. Verified against real
    Postgres: reproduced with set_config(..., is_local=false) still
    failing, confirmed by checking current_setting() had gone back to
    empty after a mid-request commit, fixed by pinning the connection.

    Reading the bind from SessionLocal.kw (rather than the module-level
    `engine` directly) so this keeps working if SessionLocal is ever
    replaced with a different engine (tests do exactly this).
    """
    bind = SessionLocal.kw["bind"]
    async with bind.connect() as connection:
        async with AsyncSession(bind=connection, expire_on_commit=False) as session:
            yield session


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: hand out one session per request, pinned to a
    single physical connection (see _pinned_session)."""
    async with _pinned_session() as session:
        try:
            yield session
        finally:
            # request.jwt.claims is session-scoped (set_config(...,
            # false), set by auth.deps.get_current_user_id), not
            # transaction-scoped, so it survives commits within this
            # request by design — it has to be reset explicitly before
            # this connection returns to the pool, or the next request to
            # borrow it would inherit this user's RLS identity.
            # Best-effort: if the connection's already broken from an
            # earlier error, there's nothing to clean up.
            try:
                await session.execute(text("RESET request.jwt.claims"))
            except Exception:
                pass


@asynccontextmanager
async def get_rls_session(user_id: str) -> AsyncIterator[AsyncSession]:
    """For code that opens its own session outside the get_session FastAPI
    dependency chain — e.g. chatbot's SSE stream, which persists messages
    from inside an async generator that outlives the request-scoped
    session — and needs the same per-request RLS identity
    get_current_user_id sets on the normal path. Same pinning +
    reset-on-exit as get_session, plus setting the claim itself since
    there's no separate get_current_user_id call to do it here.
    """
    async with _pinned_session() as session:
        await session.execute(
            text("SELECT set_config('request.jwt.claims', :claims, false)"),
            {"claims": json.dumps({"sub": user_id, "role": "authenticated"})},
        )
        try:
            yield session
        finally:
            try:
                await session.execute(text("RESET request.jwt.claims"))
            except Exception:
                pass
