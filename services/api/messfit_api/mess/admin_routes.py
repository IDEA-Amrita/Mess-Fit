import uuid
from typing import Sequence

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from messfit_api.auth.deps import require_admin
from messfit_api.db import get_session
from messfit_api.mess.models import DishORM, MessORM
from messfit_api.mess.schemas import DishBase, DishResponse, MessBase, MessResponse

router = APIRouter(prefix="/mess/admin", tags=["mess-admin"])


@router.post("/messes", response_model=MessResponse)
async def create_mess(
    mess: MessBase,
    admin_user_id: str = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> MessORM:
    """Create a mess. Requires admin role."""
    db_mess = MessORM(**mess.model_dump(), seeded_by=uuid.UUID(admin_user_id))
    db.add(db_mess)
    await db.commit()
    await db.refresh(db_mess)
    return db_mess


@router.post("/dishes", response_model=DishResponse)
async def create_dish(
    dish: DishBase,
    _: str = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
) -> DishORM:
    """Create a dish. Requires admin role."""
    db_dish = DishORM(**dish.model_dump())
    db.add(db_dish)
    await db.commit()
    await db.refresh(db_dish)
    return db_dish
