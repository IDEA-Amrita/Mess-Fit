"""College Gym — Gain. 4-day push/pull/legs/upper split, 4 duration variants.

Heavier compound focus with lower rep ranges for the gain goal. Days have up to
6 lifts; shorter durations slice to the top compounds.
"""

from __future__ import annotations

from typing import Any

from .progression import build_structure, scale_days

GOAL = "gain"
EQUIPMENT = ["college_gym"]
DAYS_PER_WEEK = 4

_DAY_POOLS = [
    {
        "day": 1,
        "name": "Push",
        "exercise_ids": [
            "bench_press",
            "overhead_press",
            "incline_bench_press",
            "lateral_raise",
            "tricep_pushdown",
        ],
    },
    {
        "day": 2,
        "name": "Pull",
        "exercise_ids": ["deadlift", "barbell_row", "lat_pulldown", "pullup", "bicep_curl"],
    },
    {
        "day": 3,
        "name": "Legs",
        "exercise_ids": [
            "barbell_squat",
            "romanian_deadlift",
            "leg_press",
            "leg_curl",
            "leg_extension",
            "calf_raise_machine",
        ],
    },
    {
        "day": 4,
        "name": "Upper",
        "exercise_ids": [
            "incline_bench_press",
            "barbell_row",
            "overhead_press",
            "bicep_curl",
            "tricep_pushdown",
            "lateral_raise",
        ],
    },
]


def make_template(duration_minutes: int) -> dict[str, Any]:
    days = scale_days(_DAY_POOLS, duration_minutes)
    return {
        "id": f"gym_bro_split_{duration_minutes}min",
        "name": f"Gym Bulk Split ({duration_minutes} min)",
        "goal": GOAL,
        "equipment_required": EQUIPMENT,
        "duration_minutes": duration_minutes,
        "days_per_week": DAYS_PER_WEEK,
        "structure": build_structure(days, base_sets=4, base_reps="8"),
    }
