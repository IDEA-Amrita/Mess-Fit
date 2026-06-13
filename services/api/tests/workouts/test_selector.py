"""Unit tests for workout selection (pure functions, no DB)."""

from __future__ import annotations

import datetime

from messfit_api.workouts.selector import position_in_cycle, select_template_id

# A Monday and a Sunday for gym-access-day logic.
_MON = datetime.date(2026, 6, 15)  # Monday
_SUN = datetime.date(2026, 6, 14)  # Sunday


# ─── the 5 quality-gate cases ─────────────────────────────────────────


def test_bodyweight_gain():
    tid = select_template_id("gain", ["bodyweight"], 30, [], _MON)
    assert tid == "bw_hostel_gain_30min"


def test_bodyweight_lose():
    tid = select_template_id("lose", ["bodyweight"], 30, [], _MON)
    assert tid == "bw_hostel_lose_30min"


def test_college_gym_gain_on_gym_day():
    tid = select_template_id("gain", ["college_gym"], 60, ["mon", "wed", "fri"], _MON)
    assert tid == "gym_bro_split_60min"


def test_college_gym_maintain_on_gym_day():
    tid = select_template_id("maintain", ["college_gym"], 45, ["mon", "wed", "fri"], _MON)
    assert tid == "gym_full_body_45min"


def test_no_gym_day_falls_back_to_bodyweight():
    # Has gym equipment, but today (Sunday) isn't a gym day → bodyweight family.
    tid = select_template_id("gain", ["college_gym"], 30, ["mon", "wed", "fri"], _SUN)
    assert tid == "bw_hostel_gain_30min"


# ─── duration rounding ────────────────────────────────────────────────


def test_duration_rounds_to_nearest_variant():
    assert select_template_id("gain", ["bodyweight"], 20, [], _MON).endswith("_15min")
    assert select_template_id("gain", ["bodyweight"], 40, [], _MON).endswith("_45min")
    assert select_template_id("gain", ["bodyweight"], 50, [], _MON).endswith("_45min")
    assert select_template_id("gain", ["bodyweight"], 90, [], _MON).endswith("_60min")


# ─── cycle position ───────────────────────────────────────────────────


def test_position_in_cycle_4day():
    assert position_in_cycle(0, 4) == (1, 1)
    assert position_in_cycle(3, 4) == (1, 4)
    assert position_in_cycle(4, 4) == (2, 1)
    assert position_in_cycle(15, 4) == (4, 4)
    assert position_in_cycle(16, 4) == (1, 1)  # wraps to a new cycle


def test_position_in_cycle_3day():
    assert position_in_cycle(0, 3) == (1, 1)
    assert position_in_cycle(3, 3) == (2, 1)
    assert position_in_cycle(11, 3) == (4, 3)
    assert position_in_cycle(12, 3) == (1, 1)
