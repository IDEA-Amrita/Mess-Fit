"""Central Celery application instance.

All tasks import the Celery app from here — never construct a second Celery()
object elsewhere in the codebase.

Broker and backend both point at the same Redis instance for V1 simplicity;
they can be split into separate URIs later without touching any task code.

Task-always-eager mode
    Set CELERY_TASK_ALWAYS_EAGER=true in the environment to run tasks
    synchronously in the calling process without a real broker or worker.
    Useful in local dev when Redis is unavailable. Must be absent (or false)
    in production and in the eval / unit test suites.
"""

from __future__ import annotations

import os

from celery import Celery  # type: ignore
from celery.schedules import crontab  # type: ignore

from .config import settings

celery_app = Celery(
    "messfit",
    broker=settings.redis_url,
    backend=settings.redis_url,
    # Modules a worker process must import so their @task decorators register.
    # The optimizer runs inline (imported via its router), but OCR + the account
    # hard-delete sweep run on a real worker, which only sees tasks listed here.
    include=[
        "messfit_api.mess.tasks",
        "messfit_api.optimizer.tasks",
        "messfit_api.account.tasks",
        "messfit_api.notifications.tasks",
        "messfit_api.analytics.tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_always_eager=os.getenv("CELERY_TASK_ALWAYS_EAGER", "").lower() in {"1", "true", "yes"},
    timezone="UTC",
    enable_utc=True,
    # Daily DPDP hard-delete sweep (Phase 9, task 9.8). Runs at 03:30 UTC.
    beat_schedule={
        "account-hard-delete-pending": {
            "task": "messfit.account.hard_delete_pending",
            "schedule": crontab(hour=3, minute=30),
        },
        # Weekly check-in: Sunday 18:00 IST = 12:30 UTC.
        "weekly-checkin-reminder": {
            "task": "messfit.notifications.weekly_checkin",
            "schedule": crontab(hour=12, minute=30, day_of_week=0),
        },
        # Analytics retention: prune events past the window, 04:00 UTC.
        "analytics-prune-old-events": {
            "task": "messfit.analytics.prune_old_events",
            "schedule": crontab(hour=4, minute=0),
        },
    },
)
