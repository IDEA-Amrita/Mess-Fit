import uuid
from typing import Any
import json

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import get_active_user_id
from ..db import get_session
from ..observability.ratelimit import limiter
from . import repository
from .schemas import NotificationPreferences, PushSubscriptionIn, TestNotificationOut
from .service import send_push_notification

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])

@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(
    sub: PushSubscriptionIn,
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session)
) -> Any:
    """Save a Web Push subscription for the current user."""
    return await repository.save_subscription(db, uuid.UUID(user_id), sub)

@router.delete("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    sub: PushSubscriptionIn,
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session)
) -> None:
    """Remove a Web Push subscription."""
    await repository.remove_subscription(db, uuid.UUID(user_id), sub.endpoint)


@router.post("/test", response_model=TestNotificationOut)
@limiter.limit("3/minute")
async def send_test_notification(
    request: Request,
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session),
) -> TestNotificationOut:
    """Push a sample notification to the caller's own devices, so they can
    confirm the whole chain (permission, subscription, server, push service)."""
    payload = json.dumps({
        "title": "MessFit test notification",
        "body": "Notifications are working on this device.",
        "url": "/dashboard/settings",
        "tag": "messfit-test",
    })
    delivered = await send_push_notification(db, uuid.UUID(user_id), payload)
    return TestNotificationOut(delivered=delivered)


@router.get("/preferences", response_model=NotificationPreferences)
async def get_preferences(
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session),
) -> NotificationPreferences:
    return NotificationPreferences(
        weekly_checkin=await repository.get_weekly_checkin_enabled(db, uuid.UUID(user_id))
    )


@router.put("/preferences", response_model=NotificationPreferences)
async def put_preferences(
    prefs: NotificationPreferences,
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session),
) -> NotificationPreferences:
    await repository.set_weekly_checkin_enabled(db, uuid.UUID(user_id), prefs.weekly_checkin)
    return prefs
