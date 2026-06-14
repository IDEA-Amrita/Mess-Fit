"""Progress metrics — pure functions.

Like ``profile.goal_engine``, these take already-loaded data and return numbers:
no I/O, no DB, deterministic, easy to unit-test. The progress endpoint
(``router.get_progress``) is the only adapter that reads rows and calls these.

All date-boundary logic assumes the caller passes IST dates / ``now_ist()``.
"""

from __future__ import annotations

import datetime as dt
import math
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Sequence

from ..profile.goal_engine import Targets


# ─── lightweight input records (decouple metrics from the ORM) ──────────


@dataclass(frozen=True)
class MealRow:
    date: dt.date
    status: str  # as_planned | different | skipped
    kcal: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fats_g: float | None = None


@dataclass(frozen=True)
class WorkoutRow:
    date: dt.date
    status: str  # done | partial | skipped


@dataclass(frozen=True)
class WeightPoint:
    date: dt.date
    weight_kg: float


# ─── adherence ──────────────────────────────────────────────────────────


def compute_adherence(
    meal_logs: Sequence[MealRow],
    workout_logs: Sequence[WorkoutRow],
    days_in_range: int,
    workout_days_per_week: int,
) -> float:
    """Overall adherence in ``[0, 1]``.

    ``meal_adherence`` = meals logged ``as_planned`` / (days × 4 slots).
    ``workout_adherence`` = workouts ``done`` / workouts *expected* in the range,
    where expected = days × ``workout_days_per_week`` / 7 (the user's own setting,
    not a hardcoded 4/7).

    When the user schedules no workouts, adherence is meal_adherence alone rather
    than averaging in an unwinnable zero.
    """
    meal_slots = days_in_range * 4
    meal_followed = sum(1 for m in meal_logs if m.status == "as_planned")
    meal_adherence = min(1.0, meal_followed / meal_slots) if meal_slots else 0.0

    expected_workouts = days_in_range * workout_days_per_week / 7
    if expected_workouts <= 0:
        return round(meal_adherence, 3)

    workout_done = sum(1 for w in workout_logs if w.status == "done")
    workout_adherence = min(1.0, workout_done / expected_workouts)

    return round((meal_adherence + workout_adherence) / 2, 3)


# ─── macro hit rate ──────────────────────────────────────────────────────


def compute_macro_hit_rate(
    meal_logs: Sequence[MealRow], targets: Targets
) -> float | None:
    """Average fraction of daily macro targets hit, over days with a plan snapshot.

    Only ``as_planned`` meals carry a macro snapshot (the client sends the planned
    meal's macros). For each such day we sum the snapshots, take the capped ratio
    consumed/target for kcal + protein + carbs + fats, and average those; the
    metric is the mean of the per-day scores. ``None`` when no snapshot days exist
    (so the UI can show "keep logging").
    """
    by_date: dict[dt.date, dict[str, float]] = defaultdict(
        lambda: {"kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fats_g": 0.0}
    )
    for m in meal_logs:
        if m.status != "as_planned" or m.kcal is None:
            continue
        by_date[m.date]["kcal"] += float(m.kcal)
        by_date[m.date]["protein_g"] += float(m.protein_g or 0)
        by_date[m.date]["carbs_g"] += float(m.carbs_g or 0)
        by_date[m.date]["fats_g"] += float(m.fats_g or 0)

    if not by_date:
        return None

    target_by_key = {
        "kcal": targets.daily_kcal,
        "protein_g": targets.daily_protein_g,
        "carbs_g": targets.daily_carbs_g,
        "fats_g": targets.daily_fats_g,
    }

    day_scores: list[float] = []
    for consumed in by_date.values():
        ratios = [
            min(1.0, consumed[k] / target_by_key[k])
            for k in target_by_key
            if target_by_key[k] > 0
        ]
        if ratios:
            day_scores.append(sum(ratios) / len(ratios))

    if not day_scores:
        return None
    return round(sum(day_scores) / len(day_scores), 3)


# ─── streak ──────────────────────────────────────────────────────────────


def compute_streak(
    meal_logs: Sequence[MealRow],
    workout_logs: Sequence[WorkoutRow],
    now: dt.datetime,
) -> int:
    """Consecutive streak days ending today.

    A *streak day* = ≥2 meal logs OR ≥1 workout logged ``done``. We count back
    from today; if today doesn't yet qualify but it's still before 18:00 (IST),
    today is skipped rather than breaking the streak (you still have the evening
    to log) — the day-boundary correctness the spec calls out.
    """
    meals_by_date: dict[dt.date, int] = defaultdict(int)
    workouts_by_date: dict[dt.date, int] = defaultdict(int)
    for m in meal_logs:
        meals_by_date[m.date] += 1
    for w in workout_logs:
        if w.status == "done":
            workouts_by_date[w.date] += 1

    def qualifies(d: dt.date) -> bool:
        return meals_by_date[d] >= 2 or workouts_by_date[d] >= 1

    today = now.date()
    streak = 0
    d = today
    while True:
        if qualifies(d):
            streak += 1
            d -= dt.timedelta(days=1)
        elif d == today and now.hour < 18:
            # Grace: today isn't over yet, don't penalise it.
            d -= dt.timedelta(days=1)
        else:
            break
    return streak


# ─── projection ──────────────────────────────────────────────────────────


def _ols_slope(xs: Sequence[float], ys: Sequence[float]) -> float:
    """Closed-form least-squares slope (numpy-free polyfit deg=1)."""
    n = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = sum((x - mx) ** 2 for x in xs)
    return num / den if den else 0.0


def compute_projection(
    weight_series: Sequence[WeightPoint],
    target_weight_kg: float,
    target_rate_kg_per_week: float,
    today: dt.date,
) -> dict[str, Any]:
    """Project the goal date from the recent weight trend.

    Fits an OLS line to the last 14 weigh-ins. Needs ≥5 logs to say anything.
    Flags a stalled trend or one moving away from the goal; otherwise returns the
    current rate and projected target date, and whether that's on track (same
    direction as the goal and ≥50% of the target rate).
    """
    if len(weight_series) < 5:
        return {"available": False, "reason": "Need at least 5 weight logs"}

    recent = sorted(weight_series, key=lambda w: w.date)[-14:]
    base = recent[0].date
    xs = [float((w.date - base).days) for w in recent]
    ys = [float(w.weight_kg) for w in recent]

    rate_per_day = _ols_slope(xs, ys)
    target_rate_per_day = target_rate_kg_per_week / 7
    current = ys[-1]

    if abs(rate_per_day) < 0.001:
        return {
            "available": True,
            "stalled": True,
            "current_rate_kg_per_week": 0.0,
        }

    days_to_target = (target_weight_kg - current) / rate_per_day
    if days_to_target < 0:
        return {"available": True, "moving_wrong_direction": True}

    projected = today + dt.timedelta(days=int(days_to_target))
    on_track = bool(
        target_rate_per_day != 0
        and _sign(rate_per_day) == _sign(target_rate_per_day)
        and abs(rate_per_day) >= 0.5 * abs(target_rate_per_day)
    )

    return {
        "available": True,
        "current_rate_kg_per_week": round(rate_per_day * 7, 2),
        "target_rate_kg_per_week": round(target_rate_per_day * 7, 2),
        "projected_target_date": projected.isoformat(),
        "on_track": on_track,
    }


def _sign(x: float) -> int:
    return int(math.copysign(1, x)) if x != 0 else 0
