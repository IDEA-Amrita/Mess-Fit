"""College Gym — Lose/Maintain. 3-day full-body, 4 duration variants.

Full body 3×/week suits a deficit (or maintenance): hit everything frequently,
moderate reps, a little conditioning. Used for both lose and maintain goals.
"""

from __future__ import annotations

from typing import Any

from .progression import build_structure, scale_days

GOAL = "maintain"  # selector routes both lose and maintain here
EQUIPMENT = ["college_gym"]
DAYS_PER_WEEK = 3

_DAY_POOLS = [
    {
        "day": 1,
        "name": "Full Body A",
        "exercise_ids": [
            "barbell_squat",
            "bench_press",
            "barbell_row",
            "overhead_press",
            "leg_curl",
            "plank",
        ],
    },
    {
        "day": 2,
        "name": "Full Body B",
        "exercise_ids": [
            "deadlift",
            "lat_pulldown",
            "leg_press",
            "lateral_raise",
            "tricep_pushdown",
            "mountain_climber",
        ],
    },
    {
        "day": 3,
        "name": "Full Body C",
        "exercise_ids": [
            "romanian_deadlift",
            "incline_bench_press",
            "pullup",
            "leg_extension",
            "bicep_curl",
            "bicycle_crunch",
        ],
    },
]


def make_template(duration_minutes: int) -> dict[str, Any]:
    days = scale_days(_DAY_POOLS, duration_minutes)
    return {
        "id": f"gym_full_body_{duration_minutes}min",
        "name": f"Gym Full Body ({duration_minutes} min)",
        "goal": GOAL,
        "equipment_required": EQUIPMENT,
        "duration_minutes": duration_minutes,
        "days_per_week": DAYS_PER_WEEK,
        "structure": build_structure(days, base_sets=3, base_reps="12"),
    }
