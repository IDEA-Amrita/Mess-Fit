"""Logging + progress HTTP endpoints (Phase 6).

POST /api/v1/logs/meals       log/relog a meal slot   (idempotent user+date+meal_type)
POST /api/v1/logs/weight      log/relog a weigh-in    (idempotent user+date)
POST /api/v1/logs/subjective  log/relog energy/hunger/mood (idempotent user+date)
GET  /api/v1/logs/today       all of today's logs (prefill)

Workout logging stays in workouts/router.py (POST /logs/workout) and is reused.
Progress query lives in this module too (see get_progress, task 6.4).
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import get_current_user_id
from ..db import get_session
from ..profile.goal_engine import compute_targets
from ..profile.repository import get_hostel_context, get_profile
from ..workouts.models import WorkoutLogORM
from . import repository
from .metrics import (
    compute_adherence,
    compute_macro_hit_rate,
    compute_projection,
    compute_streak,
)
from .models import MealLogORM, SubjectiveLogORM, WeightLogORM
from .schemas import (
    MealLogIn,
    MealLogOut,
    Progress,
    SubjectiveLogIn,
    SubjectiveLogOut,
    TodayLogs,
    WeightLogIn,
    WeightLogOut,
    WeightPoint,
)
from .time import now_ist, today_ist

_RANGE_DAYS = {"7d": 7, "30d": 30, "90d": 90}

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


@router.get("/logs/progress", response_model=Progress)
async def get_progress(
    range: Literal["7d", "30d", "90d"] = Query(default="7d"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> Progress:
    uid = uuid.UUID(user_id)

    profile = await get_profile(db, uid)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile not set up — complete onboarding first",
        )
    hostel = await get_hostel_context(db, uid)
    workout_days = hostel.workout_days_per_week if hostel else 3

    targets = compute_targets(
        dob=profile.dob,
        sex=profile.sex,
        height_cm=float(profile.height_cm),
        current_weight_kg=float(profile.current_weight_kg),
        target_rate_kg_per_week=float(profile.target_rate_kg_per_week),
        goal=profile.goal,
        activity_level=profile.activity_level,
        conditions=list(profile.conditions or []),
        today=today_ist(),
    )

    days = _RANGE_DAYS[range]
    end = today_ist()
    start = end - dt.timedelta(days=days)

    meals = await repository.meal_rows(db, uid, start, end)
    workouts = await repository.workout_rows(db, uid, start, end)
    weights = await repository.weight_points(db, uid, start, end)

    return Progress(
        range=range,
        weight_series=[
            WeightPoint(date=w.date, weight_kg=w.weight_kg) for w in weights
        ],
        adherence_rate=compute_adherence(meals, workouts, days, workout_days),
        macro_hit_rate=compute_macro_hit_rate(meals, targets),
        projection=compute_projection(
            weights,
            float(profile.target_weight_kg),
            float(profile.target_rate_kg_per_week),
            end,
        ),
        streak_days=compute_streak(meals, workouts, now_ist()),
    )
