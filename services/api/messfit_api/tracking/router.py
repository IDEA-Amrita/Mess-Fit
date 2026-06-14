"""Logging + progress HTTP endpoints (Phase 6).

POST /api/v1/logs/meals       log/relog a meal slot   (idempotent user+date+meal_type)
POST /api/v1/logs/weight      log/relog a weigh-in    (idempotent user+date)
POST /api/v1/logs/subjective  log/relog energy/hunger/mood (idempotent user+date)
GET  /api/v1/logs/today       all of today's logs (prefill)

Workout logging stays in workouts/router.py (POST /logs/workout) and is reused.
Progress query lives in this module too (see get_progress, task 6.4).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import get_current_user_id
from ..db import get_session
from ..workouts.models import WorkoutLogORM
from .models import MealLogORM, SubjectiveLogORM, WeightLogORM
from .schemas import (
    MealLogIn,
    MealLogOut,
    SubjectiveLogIn,
    SubjectiveLogOut,
    TodayLogs,
    WeightLogIn,
    WeightLogOut,
)
from .time import today_ist

router = APIRouter(prefix="/api/v1", tags=["logging"])


@router.post("/logs/meals", response_model=MealLogOut, status_code=201)
async def log_meal(
    payload: MealLogIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> MealLogORM:
    """Idempotent on (user, date, meal_type) — re-submitting updates the row."""
    values = {"user_id": uuid.UUID(user_id), **payload.model_dump()}
    update_cols = {
        k: v for k, v in values.items() if k not in ("user_id", "date", "meal_type")
    }
    stmt = (
        pg_insert(MealLogORM)
        .values(**values)
        .on_conflict_do_update(
            index_elements=["user_id", "date", "meal_type"], set_=update_cols
        )
        .returning(MealLogORM)
    )
    row = (await db.execute(stmt)).scalar_one()
    await db.commit()
    return row


@router.post("/logs/weight", response_model=WeightLogOut, status_code=201)
async def log_weight(
    payload: WeightLogIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> WeightLogORM:
    """Idempotent on (user, date)."""
    values = {"user_id": uuid.UUID(user_id), **payload.model_dump()}
    stmt = (
        pg_insert(WeightLogORM)
        .values(**values)
        .on_conflict_do_update(
            index_elements=["user_id", "date"], set_={"weight_kg": payload.weight_kg}
        )
        .returning(WeightLogORM)
    )
    row = (await db.execute(stmt)).scalar_one()
    await db.commit()
    return row


@router.post("/logs/subjective", response_model=SubjectiveLogOut, status_code=201)
async def log_subjective(
    payload: SubjectiveLogIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> SubjectiveLogORM:
    """Idempotent on (user, date)."""
    values = {"user_id": uuid.UUID(user_id), **payload.model_dump()}
    update_cols = {k: v for k, v in values.items() if k not in ("user_id", "date")}
    stmt = (
        pg_insert(SubjectiveLogORM)
        .values(**values)
        .on_conflict_do_update(index_elements=["user_id", "date"], set_=update_cols)
        .returning(SubjectiveLogORM)
    )
    row = (await db.execute(stmt)).scalar_one()
    await db.commit()
    return row


@router.get("/logs/today", response_model=TodayLogs)
async def todays_logs(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> TodayLogs:
    uid = uuid.UUID(user_id)
    today = today_ist()

    meals = (
        await db.execute(
            select(MealLogORM)
            .where(MealLogORM.user_id == uid, MealLogORM.date == today)
            .order_by(MealLogORM.meal_type)
        )
    ).scalars().all()
    weight = (
        await db.execute(
            select(WeightLogORM).where(
                WeightLogORM.user_id == uid, WeightLogORM.date == today
            )
        )
    ).scalar_one_or_none()
    subjective = (
        await db.execute(
            select(SubjectiveLogORM).where(
                SubjectiveLogORM.user_id == uid, SubjectiveLogORM.date == today
            )
        )
    ).scalar_one_or_none()
    workout = (
        await db.execute(
            select(WorkoutLogORM.status).where(
                WorkoutLogORM.user_id == uid, WorkoutLogORM.date == today
            )
        )
    ).scalars().first()

    return TodayLogs(
        date=today,
        meals=[MealLogOut.model_validate(m) for m in meals],
        weight=WeightLogOut.model_validate(weight) if weight else None,
        subjective=SubjectiveLogOut.model_validate(subjective) if subjective else None,
        workout_status=workout,
    )
