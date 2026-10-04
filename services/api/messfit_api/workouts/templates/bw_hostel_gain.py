"""Bodyweight Hostel-Room — Gain. 4-day upper/lower split, 4 duration variants.

Compounds are listed first in each day so the shorter-duration slices keep the
highest-value movements.
"""

from __future__ import annotations

from typing import Any

from .progression import build_structure, scale_days

GOAL = "gain"
EQUIPMENT = ["bodyweight"]
DAYS_PER_WEEK = 4

_DAY_POOLS = [
    {
        "day": 1,
        "name": "Upper Push",
        "exercise_ids": [
            "decline_pushup",
            "pike_pushup",
            "diamond_pushup",
            "pushup",
            "chair_dip",
            "plank_shoulder_tap",
            "plank",
            "hollow_hold",
        ],
    },
    {
        "day": 2,
        "name": "Lower",
        "exercise_ids": [
            "bulgarian_split_squat",
            "squat",
            "reverse_lunge",
            "single_leg_glute_bridge",
            "glute_bridge",
            "wall_sit",
            "calf_raise",
            "jump_squat",
        ],
    },
    {
        "day": 3,
        "name": "Upper Pull",
        "exercise_ids": [
            "inverted_row_table",
            "doorway_row",
            "pike_pushup",
            "chair_dip",
            "superman",
            "plank",
            "side_plank",
            "hollow_hold",
        ],
    },
    {
        "day": 4,
        "name": "Lower + Core",
        "exercise_ids": [
            "squat",
            "forward_lunge",
            "single_leg_glute_bridge",
            "calf_raise",
            "leg_raise",
            "crunch",
            "bicycle_crunch",
            "plank",
        ],
    },
]


def make_template(duration_minutes: int) -> dict[str, Any]:
    days = scale_days(_DAY_POOLS, duration_minutes)
    return {
        "id": f"bw_hostel_gain_{duration_minutes}min",
        "name": f"Hostel Bulk ({duration_minutes} min)",
        "goal": GOAL,
        "equipment_required": EQUIPMENT,
        "duration_minutes": duration_minutes,
        "days_per_week": DAYS_PER_WEEK,
        "structure": build_structure(days, base_sets=3, base_reps="12"),
    }
