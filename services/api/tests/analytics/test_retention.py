"""Analytics retention sweep. Uses a fake session (no DB): checks the cutoff it
asks for, that it loops in bounded batches, and that the job is scheduled."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy.dialects import postgresql

from messfit_api.analytics import tasks
from messfit_api.analytics.tasks import BATCH_SIZE, RETENTION_DAYS, prune_old_events
from messfit_api.celery_app import celery_app

NOW = datetime(2026, 9, 24, 12, 0, tzinfo=timezone.utc)


class FakeSession:
    def __init__(self, rowcounts: list[int]):
        self.rowcounts = list(rowcounts)
        self.statements: list[object] = []
        self.commits = 0

    async def execute(self, stmt):
        self.statements.append(stmt)
        return SimpleNamespace(rowcount=self.rowcounts.pop(0))

    async def commit(self):
        self.commits += 1


@pytest.mark.asyncio
async def test_deletes_only_events_older_than_the_window():
    db = FakeSession([3])
    assert await prune_old_events(db, now=NOW) == 3
    sql = db.statements[0].compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": False})
    assert "DELETE FROM analytics_events" in str(sql)
    assert "occurred_at <" in str(sql)
    cutoff = NOW - timedelta(days=RETENTION_DAYS)
    assert cutoff in sql.params.values()


@pytest.mark.asyncio
async def test_keeps_going_while_batches_are_full_and_commits_each():
    db = FakeSession([BATCH_SIZE, BATCH_SIZE, 7])
    assert await prune_old_events(db, now=NOW) == 2 * BATCH_SIZE + 7
    assert db.commits == 3


@pytest.mark.asyncio
async def test_nothing_to_prune_is_a_single_cheap_pass():
    db = FakeSession([0])
    assert await prune_old_events(db, now=NOW) == 0
    assert len(db.statements) == 1


def test_scheduled_daily_and_registered_with_the_worker():
    entry = celery_app.conf.beat_schedule["analytics-prune-old-events"]
    assert entry["task"] == tasks.prune_old_events_task.name
    assert "messfit_api.analytics.tasks" in celery_app.conf.include
