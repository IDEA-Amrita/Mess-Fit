"""Integrity + progression tests for the 16 workout templates (pure, no DB)."""

from __future__ import annotations

import pytest

from messfit_api.workouts.exercise_catalog import EXERCISES
from messfit_api.workouts.templates import all_templates
from messfit_api.workouts.templates.progression import DURATION_EXERCISE_COUNT, DURATIONS

_CATALOG_IDS = {e["id"] for e in EXERCISES}
_TEMPLATES = all_templates()


def _all_exercise_refs(structure):
    for week in structure["weeks"]:
        for day in week["days"]:
            for ex in day["exercises"]:
                yield ex


def test_sixteen_templates_unique():
    assert len(_TEMPLATES) == 16
    ids = [t["id"] for t in _TEMPLATES]
    assert len(set(ids)) == 16
    # 4 families × 4 durations.
    for fam in ("bw_hostel_gain", "bw_hostel_lose", "gym_bro_split", "gym_full_body"):
        for d in DURATIONS:
            assert f"{fam}_{d}min" in ids


def test_every_referenced_exercise_exists():
    for tpl in _TEMPLATES:
        for ex in _all_exercise_refs(tpl["structure"]):
            assert ex["exercise_id"] in _CATALOG_IDS, (
                f"{tpl['id']} references unknown exercise {ex['exercise_id']!r}"
            )


def test_each_template_has_four_weeks_of_progression():
    for tpl in _TEMPLATES:
        weeks = tpl["structure"]["weeks"]
        assert [w["week"] for w in weeks] == [1, 2, 3, 4]
        for w in weeks:
            assert len(w["days"]) == tpl["days_per_week"]
            for day in w["days"]:
                assert day["exercises"], f"{tpl['id']} week {w['week']} day {day['day']} empty"


def test_duration_scales_exercise_count():
    for tpl in _TEMPLATES:
        cap = DURATION_EXERCISE_COUNT[tpl["duration_minutes"]]
        for day in tpl["structure"]["weeks"][0]["days"]:
            assert len(day["exercises"]) <= cap


@pytest.mark.parametrize("tpl", _TEMPLATES, ids=[t["id"] for t in _TEMPLATES])
def test_progression_overloads_then_deloads(tpl):
    weeks = {w["week"]: w for w in tpl["structure"]["weeks"]}
    # Use the first exercise of day 1 as the probe.
    def probe(week):
        return weeks[week]["days"][0]["exercises"][0]

    w1, w2, w3, w4 = probe(1), probe(2), probe(3), probe(4)

    # Week 3 adds a set over baseline; week 4 deloads below week 3.
    assert w3["sets"] == w1["sets"] + 1
    assert w4["sets"] <= w1["sets"]

    # Week 2 increases volume over week 1 (rep count or hold seconds).
    def magnitude(reps: str) -> int:
        return int(reps[:-1]) if reps.endswith("s") else int(reps)

    assert magnitude(w2["reps"]) > magnitude(w1["reps"])
