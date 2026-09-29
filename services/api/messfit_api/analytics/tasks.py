"""Celery task: prune old analytics events (data minimisation).

Product analytics is only useful for recent trends, and keeping usage data
longer than it is needed is a liability. Events older than RETENTION_DAYS are
deleted daily. Runs as messfit_worker, which is the only role allowed to
DELETE from analytics_events (messfit_app is INSERT + SELECT only).

Deletes in bounded batches so a large backlog never holds a long lock; the
sweep lives in ``prune_old_events`` so tests can drive it with a session.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..celery_app import celery_app
from ..db import WorkerSessionLocal
from .models import AnalyticsEvent

RETENTION_DAYS = 180
BATCH_SIZE = 5000


async def prune_old_events(db: AsyncSession, now: datetime | None = None) -> int:
    """Delete events older than the retention window; returns the count removed."""
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=RETENTION_DAYS)
    total = 0
    while True:
        ids = select(AnalyticsEvent.id).where(AnalyticsEvent.occurred_at < cutoff).limit(BATCH_SIZE)
        result = await db.execute(delete(AnalyticsEvent).where(AnalyticsEvent.id.in_(ids)))
        await db.commit()
        removed = getattr(result, "rowcount", 0) or 0  # DELETE returns a CursorResult
        total += removed
        if removed < BATCH_SIZE:
            return total


@celery_app.task(name="messfit.analytics.prune_old_events")
def prune_old_events_task() -> dict:
    """Daily entrypoint. Opens a worker session and runs the prune."""

    async def _run() -> int:
        async with WorkerSessionLocal() as db:
            return await prune_old_events(db)

    return {"pruned": asyncio.run(_run())}
