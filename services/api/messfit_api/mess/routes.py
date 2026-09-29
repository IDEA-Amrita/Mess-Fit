import datetime
import uuid
from collections import defaultdict
from typing import Literal, Sequence

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from messfit_api.auth.deps import get_active_user_id
from messfit_api.db import get_session
from messfit_api.mess.models import (
    DishExclusionORM,
    DishFeedbackORM,
    DishORM,
    MessMenuORM,
    MessORM,
)
from messfit_api.mess.schemas import (
    DailyMenuResponse,
    DishExclusionIn,
    DishExclusionOut,
    DishFeedbackIn,
    DishResponse,
    MessResponse,
)

from .admin_routes import router as admin_router
from .ocr_routes import router as ocr_router

router = APIRouter(prefix="/mess", tags=["mess"])
router.include_router(admin_router)
router.include_router(ocr_router)


@router.get("/messes", response_model=list[MessResponse])
async def list_messes(db: AsyncSession = Depends(get_session)) -> Sequence[MessORM]:
    """List all available messes."""
    result = await db.execute(select(MessORM).order_by(MessORM.college, MessORM.name))
    return result.scalars().all()


@router.get("/dishes", response_model=list[DishResponse])
async def list_dishes(
    query: str | None = None,
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_session),
) -> Sequence[DishORM]:
    """List dishes, optionally filtering by name prefix/trigram."""
    stmt = select(DishORM)
    if query:
        # A simple ILIKE for now. For pg_trgm, we could use `.op("%%")`
        escaped_query = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(DishORM.name.ilike(f"%{escaped_query}%", escape="\\"))
    stmt = stmt.order_by(DishORM.name).limit(limit).offset(offset)
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


# ─── Menu exclusions (per-user, per-date) ────────────────────────────


@router.get("/menu/exclusions", response_model=list[DishExclusionOut])
async def list_exclusions(
    date: datetime.date | None = None,
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session),
) -> Sequence[DishExclusionORM]:
    """List dishes the calling user has marked unavailable for a date (default: today)."""
    target_date = date or datetime.date.today()
    result = await db.execute(
        select(DishExclusionORM).where(
            DishExclusionORM.user_id == uuid.UUID(user_id),
            DishExclusionORM.date == target_date,
        )
    )
    return result.scalars().all()


@router.post("/menu/exclusions", response_model=DishExclusionOut, status_code=status.HTTP_201_CREATED)
async def exclude_dish(
    payload: DishExclusionIn,
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session),
) -> DishExclusionORM:
    """Mark a dish as unavailable for a meal on a specific date. Idempotent."""
    stmt = (
        pg_insert(DishExclusionORM)
        .values(
            user_id=uuid.UUID(user_id),
            date=payload.date,
            meal_type=payload.meal_type,
            dish_id=payload.dish_id,
        )
        .on_conflict_do_nothing()
        .returning(DishExclusionORM)
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    await db.commit()

    if row is None:
        # Row already existed — fetch and return it.
        existing = await db.execute(
            select(DishExclusionORM).where(
                DishExclusionORM.user_id == uuid.UUID(user_id),
                DishExclusionORM.date == payload.date,
                DishExclusionORM.meal_type == payload.meal_type,
                DishExclusionORM.dish_id == payload.dish_id,
            )
        )
        row = existing.scalar_one()
    return row


@router.delete("/menu/exclusions/{dish_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unexclude_dish(
    dish_id: uuid.UUID,
    date: datetime.date,
    meal_type: str,
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session),
) -> None:
    """Remove a dish exclusion. No-op if the exclusion does not exist."""
    await db.execute(
        delete(DishExclusionORM).where(
            DishExclusionORM.user_id == uuid.UUID(user_id),
            DishExclusionORM.date == date,
            DishExclusionORM.meal_type == meal_type,
            DishExclusionORM.dish_id == dish_id,
        )
    )
    await db.commit()


# ─── Crowdsourcing feedback (D25) ────────────────────────────────────


@router.post("/dishes/feedback", status_code=status.HTTP_201_CREATED)
async def submit_dish_feedback(
    payload: DishFeedbackIn,
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """User confirms or denies that a scheduled dish is actually available today."""
    stmt = pg_insert(DishFeedbackORM).values(
        user_id=user_id,
        date=payload.date,
        meal_type=payload.meal_type,
        dish_id=payload.dish_id,
        vote=payload.vote,
    ).on_conflict_do_update(
        index_elements=["user_id", "date", "meal_type", "dish_id"],
        set_={"vote": payload.vote},
    )
    await db.execute(stmt)
    await db.commit()

    return await _aggregate_feedback(db, payload.date, payload.meal_type, payload.dish_id)


@router.get("/dishes/feedback")
async def get_dish_feedback(
    date: datetime.date,
    meal_type: Literal["breakfast", "lunch", "snack", "dinner"],
    dish_id: uuid.UUID,
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Get community consensus on whether a dish is available.

    Signed-in only, like every other endpoint; resolving the user also gives
    the query the identity RLS needs to read the votes (migration 019).
    """
    return await _aggregate_feedback(db, date, meal_type, dish_id)


async def _aggregate_feedback(
    db: AsyncSession,
    date: datetime.date,
    meal_type: str,
    dish_id: uuid.UUID,
) -> dict:
    """Count confirm/deny votes for a specific dish on a given date and meal."""
    from sqlalchemy import func as sa_func

    result = await db.execute(
        select(
            sa_func.count().filter(DishFeedbackORM.vote == "confirm").label("confirms"),
            sa_func.count().filter(DishFeedbackORM.vote == "deny").label("denies"),
        ).where(
            DishFeedbackORM.date == date,
            DishFeedbackORM.meal_type == meal_type,
            DishFeedbackORM.dish_id == dish_id,
        )
    )
    row = result.one()
    return {
        "dish_id": str(dish_id),
        "confirms": row.confirms,
        "denies": row.denies,
    }

