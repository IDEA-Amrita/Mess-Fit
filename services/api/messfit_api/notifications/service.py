import logging
from pywebpush import webpush, WebPushException
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from ..config import settings
from . import repository

logger = logging.getLogger(__name__)

async def send_push_notification(db: AsyncSession, user_id: uuid.UUID, payload: str) -> None:
    """Send a push notification to all subscriptions of a user."""
    if not settings.vapid_private_key:
        logger.warning("Push notifications disabled: VAPID key not set")
        return
        
    subs = await repository.get_user_subscriptions(db, user_id)
    if not subs:
        return
        
    for sub in subs:
        try:
            webpush(
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
        except WebPushException as e:
            logger.error("WebPush error sending to %s: %s", sub.endpoint, e)
            # If the subscription is expired or unsubscribed, the provider returns a 410 Gone or 404 Not Found
            if e.response is not None and e.response.status_code in (404, 410):
                await repository.remove_subscription(db, user_id, sub.endpoint)
        except Exception as e:
            logger.exception("Failed to send push notification to %s", sub.endpoint)
