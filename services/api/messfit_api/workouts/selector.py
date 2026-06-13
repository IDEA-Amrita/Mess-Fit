"""Pick the right workout template and the user's position in its cycle.

The choice is pure (template id from goal + equipment + gym access + time), so
it's trivially unit-testable; only the day-in-cycle lookup touches the DB
(it counts how many workouts the user has logged against the template).
"""

from __future__ import annotations

import datetime
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import WorkoutLogORM

_DURATIONS = [15, 30, 45, 60]


def select_template_id(
    goal: str,
    equipment: list[str],
    duration_minutes: int,
    gym_access_days: list[str],
    today: datetime.date,
) -> str:
    """Choose a template id from the user's context for *today*.

    Gym families only when the user has college-gym access AND today is one of
    their gym days; otherwise the bodyweight family. 'gain' gets the bulk
    family; 'lose'/'maintain' get the cut / full-body family. Duration rounds
    to the nearest available variant.
    """
    today_key = today.strftime("%a").lower()[:3]  # 'mon', 'tue', ...
    gym_today = "college_gym" in equipment and today_key in gym_access_days

    if gym_today:
        family = "gym_bro_split" if goal == "gain" else "gym_full_body"
    else:
        family = "bw_hostel_gain" if goal == "gain" else "bw_hostel_lose"

    chosen_duration = min(_DURATIONS, key=lambda x: abs(x - duration_minutes))
    return f"{family}_{chosen_duration}min"


def position_in_cycle(completed_count: int, days_per_week: int) -> tuple[int, int]:
    """Map total completed workouts → (week 1-4, day 1..days_per_week).

    The program is a 4-week cycle of ``days_per_week`` sessions; after the last
    session it wraps back to week 1, day 1.
    """
    cycle_len = 4 * days_per_week
    pos = completed_count % cycle_len
    week = pos // days_per_week + 1
    day = pos % days_per_week + 1
    return week, day


async def completed_workout_count(
    db: AsyncSession, user_id: uuid.UUID, template_id: str
) -> int:
    """How many workouts the user has logged for this template (done/partial)."""
    return (
        await db.execute(
            select(func.count())
            .select_from(WorkoutLogORM)
            .where(
                WorkoutLogORM.user_id == user_id,
                WorkoutLogORM.template_id == template_id,
                WorkoutLogORM.status.in_(("done", "partial")),
            )
        )
    ).scalar_one()
