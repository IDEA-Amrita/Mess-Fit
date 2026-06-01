import datetime
import uuid
from collections import defaultdict
from typing import Sequence

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from messfit_api.auth.deps import require_admin
from messfit_api.db import get_session
from messfit_api.mess.models import DishORM, MessMenuORM, MessORM
from messfit_api.mess.schemas import (
    DailyMenuResponse,
    DishBase,
    DishResponse,
    MessBase,
    MessResponse,
)

router = APIRouter(prefix="/mess", tags=["mess"])


@router.get("/messes", response_model=list[MessResponse])
async def list_messes(db: AsyncSession = Depends(get_session)) -> Sequence[MessORM]:
    """List all available messes."""
    result = await db.execute(select(MessORM).order_by(MessORM.college, MessORM.name))
    return result.scalars().all()


@router.get("/dishes", response_model=list[DishResponse])
async def list_dishes(
    query: str | None = None,
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_session),
) -> Sequence[DishORM]:
    """List dishes, optionally filtering by name prefix/trigram."""
    stmt = select(DishORM)
    if query:
        # A simple ILIKE for now. For pg_trgm, we could use `.op("%%")`
        stmt = stmt.where(DishORM.name.ilike(f"%{query}%"))
    stmt = stmt.order_by(DishORM.name).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/messes/{mess_id}/menu", response_model=DailyMenuResponse)
async def get_daily_menu(
    mess_id: uuid.UUID,
    date: datetime.date | None = None,
    db: AsyncSession = Depends(get_session),
) -> DailyMenuResponse:
    """Get the daily menu for a given mess and date (defaults to today)."""
    target_date = date or datetime.date.today()
    day_of_week = target_date.weekday()  # Monday is 0, Sunday is 6

    # Fetch all menus for this mess and day of week, including the dish data
    stmt = (
        select(MessMenuORM)
        .where(
            MessMenuORM.mess_id == mess_id,
            MessMenuORM.day_of_week == day_of_week,
            MessMenuORM.effective_from <= target_date,
            (MessMenuORM.effective_to.is_(None) | (MessMenuORM.effective_to >= target_date)),
        )
        .options(selectinload(MessMenuORM.dish))
    )
    result = await db.execute(stmt)
    menus = result.scalars().all()

    grouped = defaultdict(list)
    for m in menus:
        grouped[m.meal_type].append(m)

    return DailyMenuResponse(
        date=target_date,
        day_of_week=day_of_week,
        breakfast=grouped.get("breakfast", []),
        lunch=grouped.get("lunch", []),
        snack=grouped.get("snack", []),
        dinner=grouped.get("dinner", []),
    )


@router.post("/admin/messes", response_model=MessResponse)
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


@router.post("/admin/dishes", response_model=DishResponse)
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
