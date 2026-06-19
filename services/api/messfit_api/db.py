"""Async SQLAlchemy engine + session factory.

We keep this tiny on purpose: one engine for the whole process, one
session per request via the ``get_session`` dependency. RLS context
(``request.jwt.claim.sub``) is set per-request in the auth dependency
that hands off to ``get_session``.
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


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: hand out one session per request."""
    async with SessionLocal() as session:
        yield session
