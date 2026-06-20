"""Celery tasks for background notifications.

Includes the weekly check-in flow (C23) that runs every Sunday evening to remind
users to log their weight and review their progress.
"""

from __future__ import annotations

import asyncio
import json
import structlog
from celery import shared_task
from sqlalchemy import select

from ..celery_app import celery_app
from ..db import SessionLocal
from ..profile.models import Profile
from .service import send_push_notification

logger = structlog.get_logger(__name__)


async def _notify_weekly_checkin() -> None:
    """Async implementation of the weekly check-in notification."""
    async with SessionLocal() as db:
        # Fetch all users who have an active profile.
        # In a real app, we'd batch this and check their timezone or push settings.
        result = await db.execute(select(Profile.user_id))
        user_ids = result.scalars().all()

        payload = json.dumps({
            "title": "Weekly Check-in 📈",
            "body": "It's Sunday evening! Time to log your weight and check your adherence for the week.",
            "url": "/dashboard/progress",
        })

        success_count = 0
        for uid in user_ids:
            try:
                await send_push_notification(db, uid, payload)
                success_count += 1
            except Exception as e:
                logger.warning("Failed to send weekly check-in", user_id=str(uid), error=str(e))

        logger.info("Weekly check-in notifications sent", total_attempted=len(user_ids), successes=success_count)


@shared_task
def send_weekly_checkin_reminders() -> None:
    """Trigger the weekly check-in push notification for all users.
    
    Intended to be scheduled via Celery Beat every Sunday at 18:00 IST.
    """
    logger.info("Starting weekly check-in reminder task")
    asyncio.run(_notify_weekly_checkin())
