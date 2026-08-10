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

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import get_current_user_id
from ..db import get_session
from ..observability.ratelimit import limiter
from ..profile.goal_engine import compute_targets
from ..profile.repository import get_hostel_context, get_profile
from ..workouts.models import WorkoutLogORM
from . import repository
from .metrics import (
    compute_adaptive_tdee,
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
from .vision import estimate_meal_from_photo

_RANGE_DAYS = {"7d": 7, "30d": 30, "90d": 90}

router = APIRouter(prefix="/api/v1", tags=["logging"])


@router.post("/logs/photo", status_code=201)
@limiter.limit("10/minute")
async def log_meal_photo(
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> Any:
    """Accept a photo of a meal plate, estimate macros via Gemini Vision, and log it.

    The client sends the photo as a multipart form upload. The endpoint
    returns the AI-estimated macros so the user can review/correct before
    confirming. Does NOT auto-save a meal log — the client should call
    POST /logs/meals after the user confirms.
    """
    # For proper multipart handling, we read from the request body
    form = await request.form()
    photo = form.get("photo")
    meal_type = form.get("meal_type", "lunch")

    if photo is None or not hasattr(photo, "read"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No photo uploaded")

    image_bytes = await photo.read()  # type: ignore[union-attr]
    content_type = getattr(photo, "content_type", "image/jpeg") or "image/jpeg"

    estimate = await estimate_meal_from_photo(image_bytes, content_type)

    return {
        "meal_type": meal_type,
        "dishes": estimate.dishes,
        "total_kcal": estimate.total_kcal,
        "total_protein_g": estimate.total_protein_g,
        "total_carbs_g": estimate.total_carbs_g,
        "total_fats_g": estimate.total_fats_g,
        "confidence": estimate.confidence,
    }


@router.get("/logs/leaderboard")
async def leaderboard(
    days: int = Query(default=7, ge=1, le=90),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> Any:
    """Weekly adherence leaderboard for the user's college."""
    from .leaderboard import get_college_leaderboard

    uid = uuid.UUID(user_id)
    hostel = await get_hostel_context(db, uid)
    if hostel is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Complete onboarding to see the leaderboard",
        )

    # Look up the college from the user's mess.
    from ..mess.models import MessORM
    mess = (
        await db.execute(select(MessORM).where(MessORM.id == hostel.mess_id))
    ).scalar_one_or_none()

    if mess is None:
        return {"entries": [], "user_rank": None}

    entries = await get_college_leaderboard(db, mess.college, days=days)

    # Find the current user's rank.
    user_rank = next(
        (e for e in entries if e["user_id"] == user_id), None
    )

    return {"entries": entries, "user_rank": user_rank}


@router.post("/logs/meals", response_model=MealLogOut, status_code=201)
@limiter.limit("30/minute")
async def log_meal(
    request: Request,
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
@limiter.limit("30/minute")
async def log_weight(
    request: Request,
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
@limiter.limit("30/minute")
async def log_subjective(
    request: Request,
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

    # Adaptive TDEE: uses energy balance equation over the tracking window.
    adaptive = compute_adaptive_tdee(weights, meals, targets.tdee)

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
        adaptive_tdee={
            "available": adaptive.available,
            "tdee": adaptive.tdee,
            "confidence": adaptive.confidence,
            "data_days": adaptive.data_days,
            "method": adaptive.method,
            "reason": adaptive.reason,
        },
    )
