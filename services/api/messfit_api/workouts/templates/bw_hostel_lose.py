"""Bodyweight Hostel-Room — Lose. 3-day full-body + cardio, 4 duration variants.

Full body (not a split) because a cutting user typically trains 2-3 days/week;
each session mixes a compound, a pull, and conditioning to keep calorie burn up.
"""

from __future__ import annotations

from typing import Any

from .progression import build_structure, scale_days

GOAL = "lose"
EQUIPMENT = ["bodyweight"]
DAYS_PER_WEEK = 3

_DAY_POOLS = [
    {"day": 1, "name": "Full Body A", "exercise_ids": [
        "squat", "pushup", "inverted_row_table", "reverse_lunge",
        "burpee", "mountain_climber", "plank", "high_knees"]},
    {"day": 2, "name": "Full Body B", "exercise_ids": [
        "jump_squat", "decline_pushup", "doorway_row", "glute_bridge",
        "skater", "jumping_jack", "bicycle_crunch", "side_plank"]},
    {"day": 3, "name": "Full Body C", "exercise_ids": [
        "forward_lunge", "pike_pushup", "superman", "single_leg_glute_bridge",
        "burpee", "high_knees", "leg_raise", "plank"]},
]


def make_template(duration_minutes: int) -> dict[str, Any]:
    days = scale_days(_DAY_POOLS, duration_minutes)
    return {
        "id": f"bw_hostel_lose_{duration_minutes}min",
        "name": f"Hostel Cut ({duration_minutes} min)",
        "goal": GOAL,
        "equipment_required": EQUIPMENT,
        "duration_minutes": duration_minutes,
        "days_per_week": DAYS_PER_WEEK,
        "structure": build_structure(days, base_sets=3, base_reps="15"),
    }
