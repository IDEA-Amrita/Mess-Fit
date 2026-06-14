"""Range reads for the progress endpoint.

Thin async functions returning the lightweight metric records (not ORM rows),
so the metrics layer stays decoupled from SQLAlchemy.
"""

from __future__ import annotations

import datetime as dt
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..workouts.models import WorkoutLogORM
from .metrics import MealRow, WeightPoint, WorkoutRow
from .models import MealLogORM, WeightLogORM


async def meal_rows(
    db: AsyncSession, user_id: UUID, start: dt.date, end: dt.date
) -> list[MealRow]:
    rows = (
        await db.execute(
            select(
                MealLogORM.date,
                MealLogORM.status,
                MealLogORM.kcal,
                MealLogORM.protein_g,
                MealLogORM.carbs_g,
                MealLogORM.fats_g,
            ).where(
                MealLogORM.user_id == user_id,
                MealLogORM.date >= start,
                MealLogORM.date <= end,
            )
        )
    ).all()
    return [
        MealRow(
            date=r.date,
            status=r.status,
            kcal=float(r.kcal) if r.kcal is not None else None,
            protein_g=float(r.protein_g) if r.protein_g is not None else None,
            carbs_g=float(r.carbs_g) if r.carbs_g is not None else None,
            fats_g=float(r.fats_g) if r.fats_g is not None else None,
        )
        for r in rows
    ]


async def workout_rows(
    db: AsyncSession, user_id: UUID, start: dt.date, end: dt.date
) -> list[WorkoutRow]:
    rows = (
        await db.execute(
            select(WorkoutLogORM.date, WorkoutLogORM.status).where(
                WorkoutLogORM.user_id == user_id,
                WorkoutLogORM.date >= start,
                WorkoutLogORM.date <= end,
            )
        )
    ).all()
    return [WorkoutRow(date=r.date, status=r.status) for r in rows]


async def weight_points(
    db: AsyncSession, user_id: UUID, start: dt.date, end: dt.date
) -> list[WeightPoint]:
    rows = (
        await db.execute(
            select(WeightLogORM.date, WeightLogORM.weight_kg)
            .where(
                WeightLogORM.user_id == user_id,
                WeightLogORM.date >= start,
                WeightLogORM.date <= end,
            )
            .order_by(WeightLogORM.date)
        )
    ).all()
    return [WeightPoint(date=r.date, weight_kg=float(r.weight_kg)) for r in rows]
