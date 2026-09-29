import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, func, select, text
from sqlalchemy.dialects.postgresql import insert

from .models import NotificationPreferences, PushSubscription
from ..auth.models import UserORM
from .schemas import PushSubscriptionIn

async def save_subscription(db: AsyncSession, sub: PushSubscriptionIn) -> None:
    """Register this browser's subscription for the signed-in user.

    Goes through claim_push_subscription() (migration 018) rather than a plain
    upsert: the endpoint may still belong to whoever used this browser before,
    and own-row RLS rightly forbids touching their row directly. The function
    always assigns the row to auth.uid(), so the caller can't be spoofed.
    """
    await db.execute(
        text("SELECT claim_push_subscription(:endpoint, :p256dh, :auth)"),
        {"endpoint": sub.endpoint, "p256dh": sub.keys.p256dh, "auth": sub.keys.auth},
    )
    await db.commit()


async def remove_subscription(db: AsyncSession, user_id: uuid.UUID, endpoint: str) -> None:
    stmt = delete(PushSubscription).where(
        PushSubscription.user_id == user_id,
        PushSubscription.endpoint == endpoint
    )
    await db.execute(stmt)
    await db.commit()

async def get_user_subscriptions(db: AsyncSession, user_id: uuid.UUID) -> list[PushSubscription]:
    stmt = select(PushSubscription).where(PushSubscription.user_id == user_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_weekly_checkin_enabled(db: AsyncSession, user_id: uuid.UUID) -> bool:
    stmt = select(NotificationPreferences.weekly_checkin).where(NotificationPreferences.user_id == user_id)
    value = (await db.execute(stmt)).scalar_one_or_none()
    return True if value is None else value


async def set_weekly_checkin_enabled(db: AsyncSession, user_id: uuid.UUID, enabled: bool) -> None:
    stmt = insert(NotificationPreferences).values(user_id=user_id, weekly_checkin=enabled)
    stmt = stmt.on_conflict_do_update(
        index_elements=["user_id"],
        set_={"weekly_checkin": stmt.excluded.weekly_checkin, "updated_at": func.now()},
    )
    await db.execute(stmt)
    await db.commit()


async def list_weekly_checkin_recipients(db: AsyncSession) -> list[uuid.UUID]:
    """Users who should get the weekly check-in: at least one registered device,
    account not pending deletion, and not opted out. Needs a cross-user session
    (the worker role)."""
    stmt = (
        select(PushSubscription.user_id)
        .join(UserORM, UserORM.id == PushSubscription.user_id)
        .outerjoin(NotificationPreferences, NotificationPreferences.user_id == PushSubscription.user_id)
        .where(
            UserORM.deleted_at.is_(None),
            func.coalesce(NotificationPreferences.weekly_checkin, True).is_(True),
        )
        .distinct()
    )
    return list((await db.execute(stmt)).scalars().all())
