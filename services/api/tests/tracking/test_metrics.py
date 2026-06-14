"""Unit tests for the pure progress metrics (Phase 6, task 6.3).

No DB — these mirror the goal_engine test style: construct inputs, assert numbers.
"""

from __future__ import annotations

import datetime as dt

from messfit_api.profile.goal_engine import Targets
from messfit_api.tracking.metrics import (
    MealRow,
    WeightPoint,
    WorkoutRow,
    compute_adherence,
    compute_macro_hit_rate,
    compute_projection,
    compute_streak,
)

D = dt.date


def _targets(**over) -> Targets:
    base = dict(
        bmi=22.0,
        bmi_class="normal",
        bmr=1500.0,
        tdee=2300.0,
        daily_kcal=2400,
        daily_protein_g=120,
        daily_carbs_g=300,
        daily_fats_g=70,
        rationale={},
    )
    base.update(over)
    return Targets(**base)  # type: ignore[arg-type]


# ─── adherence ────────────────────────────────────────────────────────


def test_adherence_meals_and_workouts():
    # 7-day range: 14 meals as_planned of 28 slots → 0.5 meal adherence.
    meals = [MealRow(D(2026, 6, 1), "as_planned")] * 14
    # workout_days_per_week=4 → expected 4 over 7 days; 2 done → 0.5.
    workouts = [WorkoutRow(D(2026, 6, 1), "done")] * 2
    adh = compute_adherence(meals, workouts, days_in_range=7, workout_days_per_week=4)
    assert adh == 0.5  # (0.5 + 0.5) / 2


def test_adherence_no_workouts_scheduled_uses_meals_only():
    meals = [MealRow(D(2026, 6, 1), "as_planned")] * 7  # 7/28 = 0.25
    adh = compute_adherence(meals, [], days_in_range=7, workout_days_per_week=0)
    assert adh == 0.25


def test_adherence_caps_at_one():
    meals = [MealRow(D(2026, 6, 1), "as_planned")] * 40  # > 28 slots
    workouts = [WorkoutRow(D(2026, 6, 1), "done")] * 99
    adh = compute_adherence(meals, workouts, days_in_range=7, workout_days_per_week=4)
    assert adh == 1.0


# ─── macro hit rate ───────────────────────────────────────────────────


def test_macro_hit_rate_perfect_day():
    t = _targets()
    # One day, snapshots summing exactly to target → 1.0.
    meals = [
        MealRow(D(2026, 6, 1), "as_planned", kcal=2400, protein_g=120, carbs_g=300, fats_g=70),
    ]
    assert compute_macro_hit_rate(meals, t) == 1.0


def test_macro_hit_rate_half_day_capped():
    t = _targets()
    meals = [
        MealRow(D(2026, 6, 1), "as_planned", kcal=1200, protein_g=60, carbs_g=150, fats_g=35),
    ]
    assert compute_macro_hit_rate(meals, t) == 0.5


def test_macro_hit_rate_ignores_non_planned_and_returns_none_when_empty():
    t = _targets()
    assert compute_macro_hit_rate([MealRow(D(2026, 6, 1), "skipped")], t) is None
    assert compute_macro_hit_rate([], t) is None


# ─── streak ───────────────────────────────────────────────────────────


def test_streak_counts_consecutive_days():
    now = dt.datetime(2026, 6, 14, 20, 0)  # evening, today counts
    meals = []
    for day in (12, 13, 14):
        meals += [MealRow(D(2026, 6, day), "as_planned")] * 2  # ≥2 → qualifies
    assert compute_streak(meals, [], now) == 3


def test_streak_breaks_on_gap():
    now = dt.datetime(2026, 6, 14, 20, 0)
    meals = [MealRow(D(2026, 6, 14), "as_planned")] * 2  # today only
    # 12th has a workout, but 13th is empty → streak stops at today.
    workouts = [WorkoutRow(D(2026, 6, 12), "done")]
    assert compute_streak(meals, workouts, now) == 1


def test_streak_today_grace_before_evening():
    # Before 18:00 with nothing logged today, yesterday's streak survives.
    now = dt.datetime(2026, 6, 14, 9, 0)
    meals = [MealRow(D(2026, 6, 13), "as_planned")] * 2
    assert compute_streak(meals, [], now) == 1


def test_streak_today_unlogged_after_evening_breaks():
    now = dt.datetime(2026, 6, 14, 21, 0)
    meals = [MealRow(D(2026, 6, 13), "as_planned")] * 2
    assert compute_streak(meals, [], now) == 0


# ─── projection ───────────────────────────────────────────────────────


def test_projection_needs_five_logs():
    series = [WeightPoint(D(2026, 6, i + 1), 60) for i in range(4)]
    out = compute_projection(series, 65, 0.25, D(2026, 6, 10))
    assert out["available"] is False


def test_projection_on_track_gaining():
    # +0.05 kg/day ≈ +0.35 kg/wk, target +0.25 kg/wk, same direction, ≥50%.
    series = [WeightPoint(D(2026, 6, i + 1), 60 + 0.05 * i) for i in range(10)]
    out = compute_projection(series, 65, 0.25, D(2026, 6, 10))
    assert out["available"] is True
    assert out["on_track"] is True
    assert out["current_rate_kg_per_week"] > 0
    assert "projected_target_date" in out


def test_projection_stalled():
    series = [WeightPoint(D(2026, 6, i + 1), 60.0) for i in range(10)]
    out = compute_projection(series, 65, 0.25, D(2026, 6, 10))
    assert out.get("stalled") is True


def test_projection_wrong_direction():
    # Losing weight while target is to gain → moving away.
    series = [WeightPoint(D(2026, 6, i + 1), 60 - 0.05 * i) for i in range(10)]
    out = compute_projection(series, 65, 0.25, D(2026, 6, 10))
    assert out.get("moving_wrong_direction") is True
