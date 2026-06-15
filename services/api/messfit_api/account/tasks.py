"""Celery task: permanently delete accounts past their grace period (9.8).

Scheduled daily via Celery beat (see celery_app.py). Hard-deletes users whose
deleted_at is older than the 30-day grace period; FK ON DELETE CASCADE removes
all of their owned rows. Returns the count for observability.

The async sweep lives in ``sweep_pending_deletions`` so tests can drive it with a
session directly (mirrors mess/tasks.py::_process_job); the Celery task just
opens a session and runs it.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..celery_app import celery_app
from ..db import SessionLocal
from . import repository
from .schemas import GRACE_PERIOD_DAYS


async def sweep_pending_deletions(
    db: AsyncSession, now: datetime | None = None
) -> int:
    """Erase accounts whose grace period elapsed; returns the count removed."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=GRACE_PERIOD_DAYS)
    user_ids = await repository.list_pending_hard_delete(db, cutoff)
    for uid in user_ids:
        await repository.hard_delete_user(db, uid)
    return len(user_ids)


@celery_app.task(name="messfit.account.hard_delete_pending")
def hard_delete_pending() -> dict:
    """Daily entrypoint. Opens a session and runs the sweep."""

    async def _run() -> int:
        async with SessionLocal() as db:
            return await sweep_pending_deletions(db)

    return {"hard_deleted": asyncio.run(_run())}
