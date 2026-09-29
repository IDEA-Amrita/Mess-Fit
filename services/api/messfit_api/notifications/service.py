import asyncio

import structlog
from pywebpush import webpush, WebPushException  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from ..config import settings
from . import repository
from .schemas import is_push_service_url

logger = structlog.get_logger(__name__)

async def send_push_notification(db: AsyncSession, user_id: uuid.UUID, payload: str) -> int:
    """Send a push notification to all subscriptions of a user.

    Returns how many subscriptions the push service accepted."""
    if not settings.vapid_private_key:
        logger.warning("Push notifications disabled: VAPID key not set")
        return 0
        
    subs = await repository.get_user_subscriptions(db, user_id)
    if not subs:
        return 0

    delivered = 0
        
    for sub in subs:
        # Stored before endpoints were validated? Never POST to it (SSRF).
        if not is_push_service_url(sub.endpoint):
            logger.warning("Dropping push subscription with a non-push-service endpoint", user_id=str(user_id))
            await repository.remove_subscription(db, user_id, sub.endpoint)
            continue
        try:
            # pywebpush is synchronous (blocking HTTP); keep it off the event loop.
            await asyncio.to_thread(
                webpush,
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth
                    }
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={
                    "sub": settings.vapid_subscriber,
                }
            )
            delivered += 1
        except WebPushException as e:
            logger.error("WebPush error", endpoint=sub.endpoint, error=str(e))
            # If the subscription is expired or unsubscribed, the provider returns a 410 Gone or 404 Not Found
            if e.response is not None and e.response.status_code in (404, 410):
                await repository.remove_subscription(db, user_id, sub.endpoint)
        except Exception:
            logger.exception("Failed to send push notification", endpoint=sub.endpoint)
    return delivered
