"""Shared progressive-overload builder for workout templates.

Given a set of training days (each a list of exercise ids) plus a family's
baseline sets/reps, build a 4-week ``structure`` with week-on-week overload:

    Week 1  baseline
    Week 2  +1 rep per set
    Week 3  +1 set per exercise (keeps week-2's rep gain)
    Week 4  deload — ~60% of baseline sets, reps back to baseline (form focus)

After week 4 the program cycles back to week 1 at a slightly higher baseline
(the selector handles where the user is). Reps are either a plain count ("10")
or a time hold ("40s"); time-based moves progress by +5s instead of +1 rep.
"""

from __future__ import annotations

from typing import Any

# Exercises measured by time, not reps — progress in seconds.
TIME_BASED = {
    "plank", "side_plank", "hollow_hold", "wall_sit", "plank_shoulder_tap",
    "high_knees", "jumping_jack", "skater", "jump_rope", "mountain_climber",
}


def _bump(reps: str, rep_inc: int = 1, time_inc: int = 5) -> str:
    if reps.endswith("s"):
        return f"{int(reps[:-1]) + time_inc}s"
    return str(int(reps) + rep_inc)


def _baseline_reps(exercise_id: str, reps: str, time_reps: str) -> str:
    return time_reps if exercise_id in TIME_BASED else reps


def build_structure(
    days: list[dict[str, Any]],
    base_sets: int,
    base_reps: str,
    time_reps: str = "40s",
) -> dict[str, Any]:
    """days: [{"day": 1, "name": "Upper Push", "exercise_ids": [...]}, ...]."""
    weeks: list[dict[str, Any]] = []
    for wk in range(1, 5):
        wk_days = []
        for d in days:
            exercises = []
            for ex_id in d["exercise_ids"]:
                r0 = _baseline_reps(ex_id, base_reps, time_reps)
                if wk == 1:
                    sets, reps = base_sets, r0
                elif wk == 2:
                    sets, reps = base_sets, _bump(r0)
                elif wk == 3:
                    sets, reps = base_sets + 1, _bump(r0)
                else:  # week 4 deload
                    sets, reps = max(1, round(base_sets * 0.6)), r0
                exercises.append({"exercise_id": ex_id, "sets": sets, "reps": reps})
            wk_days.append({"day": d["day"], "name": d["name"], "exercises": exercises})
        weeks.append({"week": wk, "days": wk_days})
    return {"weeks": weeks}


# Exercises to show per session, by available time (most-important-first slice).
DURATION_EXERCISE_COUNT = {15: 2, 30: 4, 45: 6, 60: 8}
DURATIONS = [15, 30, 45, 60]


def scale_days(day_pools: list[dict[str, Any]], duration: int) -> list[dict[str, Any]]:
    """Take the first N exercises of each day for the given duration."""
    n = DURATION_EXERCISE_COUNT[duration]
    return [
        {"day": d["day"], "name": d["name"], "exercise_ids": d["exercise_ids"][:n]}
        for d in day_pools
    ]
