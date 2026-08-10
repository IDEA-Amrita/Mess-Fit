import uuid
from typing import Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import get_current_user_id
from ..db import get_session
from . import repository
from .schemas import PushSubscriptionIn

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])

@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(
    sub: PushSubscriptionIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session)
) -> Any:
    """Save a Web Push subscription for the current user."""
    return await repository.save_subscription(db, uuid.UUID(user_id), sub)

@router.delete("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    sub: PushSubscriptionIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session)
) -> None:
    """Remove a Web Push subscription."""
    await repository.remove_subscription(db, uuid.UUID(user_id), sub.endpoint)
