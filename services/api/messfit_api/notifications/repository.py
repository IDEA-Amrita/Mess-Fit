import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert

from .models import PushSubscription
from .schemas import PushSubscriptionIn

async def save_subscription(db: AsyncSession, user_id: uuid.UUID, sub: PushSubscriptionIn) -> PushSubscription:
    stmt = insert(PushSubscription).values(
        user_id=user_id,
        endpoint=sub.endpoint,
        p256dh=sub.keys.get("p256dh", ""),
        auth=sub.keys.get("auth", "")
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["endpoint"],
        set_={
            "user_id": stmt.excluded.user_id,
            "p256dh": stmt.excluded.p256dh,
            "auth": stmt.excluded.auth,
        }
    ).returning(PushSubscription)
    
    result = await db.execute(stmt)
    await db.commit()
    return result.scalar_one()

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
