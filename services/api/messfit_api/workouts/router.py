"""Workout planner HTTP endpoints.

GET  /api/v1/workouts/today        today's session for the authed user
GET  /api/v1/workouts/templates    all 16 templates (browse)
GET  /api/v1/exercises/{id}        one exercise's full detail
POST /api/v1/logs/workout          log a workout (idempotent on user+date+template)
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import get_current_user_id
from ..db import get_session
from ..profile.repository import get_hostel_context, get_profile
from .models import ExerciseORM, WorkoutLogORM, WorkoutTemplateORM
from .schemas import (
    ExerciseDetail,
    TemplateSummary,
    TodayWorkout,
    WorkoutExercise,
    WorkoutLogIn,
    WorkoutLogOut,
)
from .selector import (
    completed_workout_count,
    position_in_cycle,
    select_template_id,
)

router = APIRouter(prefix="/api/v1", tags=["workouts"])


def _find_day(structure: dict[str, Any], week: int, day: int) -> dict[str, Any] | None:
    for w in structure.get("weeks", []):
        if w["week"] == week:
            for d in w["days"]:
                if d["day"] == day:
                    return d
    return None


@router.get("/workouts/today", response_model=TodayWorkout)
async def workout_today(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> TodayWorkout:
    uid = uuid.UUID(user_id)
    today = datetime.date.today()

    profile = await get_profile(db, uid)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Profile not set up — complete onboarding first")
    hostel = await get_hostel_context(db, uid)
    if hostel is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Hostel context not set up — complete onboarding first")

    template_id = select_template_id(
        goal=profile.goal,
        equipment=list(hostel.equipment or []),
        duration_minutes=hostel.workout_minutes_per_day,
        gym_access_days=list(hostel.gym_access_days or []),
        today=today,
    )

    template = await db.get(WorkoutTemplateORM, template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Workout template {template_id!r} not seeded — run seed_templates.py",
        )

    count = await completed_workout_count(db, uid, template_id)
    week, day = position_in_cycle(count, template.days_per_week)
    day_entry = _find_day(template.structure, week, day)
    if day_entry is None:
        raise HTTPException(status_code=500, detail="Template structure missing the computed day")

    refs = day_entry["exercises"]
    ids = [r["exercise_id"] for r in refs]
    rows = (await db.execute(select(ExerciseORM).where(ExerciseORM.id.in_(ids)))).scalars().all()
    by_id = {e.id: e for e in rows}

    exercises: list[WorkoutExercise] = []
    for r in refs:
        ex = by_id.get(r["exercise_id"])
        if ex is None:
            continue  # exercise not seeded; skip rather than 500
        exercises.append(
            WorkoutExercise(
                exercise_id=ex.id,
                name=ex.name,
                primary_muscle=ex.primary_muscle,
                sets=r["sets"],
                reps=r["reps"],
                rest_seconds=ex.rest_seconds,
                youtube_video_id=ex.youtube_video_id,
                instruction_text=ex.instruction_text,
                common_mistakes=list(ex.common_mistakes or []),
            )
        )

    return TodayWorkout(
        template_id=template.id,
        template_name=template.name,
        goal=template.goal,
        week=week,
        day=day,
        day_name=day_entry["name"],
        exercises=exercises,
    )


@router.get("/workouts/templates", response_model=list[TemplateSummary])
async def list_templates(
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> Sequence[WorkoutTemplateORM]:
    return (
        await db.execute(select(WorkoutTemplateORM).order_by(WorkoutTemplateORM.id))
    ).scalars().all()


@router.get("/exercises/{exercise_id}", response_model=ExerciseDetail)
async def get_exercise(
    exercise_id: str,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> ExerciseORM:
    ex = await db.get(ExerciseORM, exercise_id)
    if ex is None:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return ex


@router.post("/logs/workout", response_model=WorkoutLogOut, status_code=status.HTTP_201_CREATED)
async def log_workout(
    payload: WorkoutLogIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> WorkoutLogORM:
    """Persist a workout. Idempotent on (user, date, template) — re-submitting
    updates the existing row rather than duplicating."""
    uid = uuid.UUID(user_id)
    values = {
        "user_id": uid,
        "date": payload.date,
        "template_id": payload.template_id,
        "exercises_done": [e.model_dump() for e in payload.exercises_done],
        "status": payload.status,
        "skip_reason": payload.skip_reason,
    }
    update_cols = {k: v for k, v in values.items()
                   if k not in ("user_id", "date", "template_id")}
    stmt = (
        pg_insert(WorkoutLogORM)
        .values(**values)
        .on_conflict_do_update(
            index_elements=["user_id", "date", "template_id"], set_=update_cols
        )
        .returning(WorkoutLogORM)
    )
    row = (await db.execute(stmt)).scalar_one()
    await db.commit()
    return row
