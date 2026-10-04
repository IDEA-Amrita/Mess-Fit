"""Tests for the workouts API endpoints.

Reference data (exercises + templates) is seeded idempotently from the package
source of truth; profile + hostel context are set up via the real profile API so
the selector has something to read. Workout logs are cleaned up with the test
user (CASCADE) by the conftest fixture.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from messfit_api.workouts.exercise_catalog import EXERCISES
from messfit_api.workouts.models import ExerciseORM, WorkoutTemplateORM
from messfit_api.workouts.templates import all_templates


@pytest.fixture
async def seeded_workouts(db_session: AsyncSession):
    """Idempotently ensure exercises + templates exist (reference data)."""
    for ex in EXERCISES:
        cols = {k: v for k, v in ex.items() if k != "id"}
        cols.pop("youtube_video_id", None)
        await db_session.execute(
            pg_insert(ExerciseORM)
            .values(**ex)
            .on_conflict_do_update(index_elements=["id"], set_=cols)
        )
    for tpl in all_templates():
        cols = {k: v for k, v in tpl.items() if k != "id"}
        await db_session.execute(
            pg_insert(WorkoutTemplateORM)
            .values(**tpl)
            .on_conflict_do_update(index_elements=["id"], set_=cols)
        )
    await db_session.commit()


async def _setup_profile(client, make_profile_payload, make_hostel_payload, **hostel):
    await client.put(
        "/api/v1/profile/me", json=make_profile_payload(goal=hostel.pop("goal", "gain"))
    )
    payload = make_hostel_payload(**hostel)
    await client.put("/api/v1/profile/hostel-context", json=payload)


# ─── today ────────────────────────────────────────────────────────────


async def test_today_returns_session(
    client, seeded_workouts, make_profile_payload, make_hostel_payload
):
    await _setup_profile(
        client,
        make_profile_payload,
        make_hostel_payload,
        goal="gain",
        equipment=["bodyweight"],
        workout_minutes_per_day=30,
        gym_access_days=[],
    )
    resp = await client.get("/api/v1/workouts/today")
    assert resp.status_code == 200
    body = resp.json()
    assert body["template_id"] == "bw_hostel_gain_30min"
    assert body["week"] == 1 and body["day"] == 1
    assert len(body["exercises"]) > 0
    first = body["exercises"][0]
    assert first["name"] and first["sets"] and first["reps"]
    # 30-min variant caps day exercises at 4.
    assert len(body["exercises"]) <= 4


async def test_today_409_without_onboarding(client, seeded_workouts):
    # No profile set up for this fresh user.
    resp = await client.get("/api/v1/workouts/today")
    assert resp.status_code == 409


async def test_today_advances_after_logging(
    client, seeded_workouts, make_profile_payload, make_hostel_payload
):
    await _setup_profile(
        client,
        make_profile_payload,
        make_hostel_payload,
        goal="gain",
        equipment=["bodyweight"],
        workout_minutes_per_day=30,
        gym_access_days=[],
    )
    # Log day 1 done → next 'today' should be day 2.
    await client.post(
        "/api/v1/logs/workout",
        json={
            "date": "2026-06-15",
            "template_id": "bw_hostel_gain_30min",
            "exercises_done": [],
            "status": "done",
        },
    )
    body = (await client.get("/api/v1/workouts/today")).json()
    assert body["day"] == 2


# ─── templates / exercises ────────────────────────────────────────────


async def test_list_templates(client, seeded_workouts):
    body = (await client.get("/api/v1/workouts/templates")).json()
    assert len(body) == 16


async def test_get_exercise(client, seeded_workouts):
    body = (await client.get("/api/v1/exercises/pushup")).json()
    assert body["id"] == "pushup"
    assert body["instruction_text"]
    assert body["youtube_video_id"] is None  # not curated yet


async def test_get_exercise_404(client, seeded_workouts):
    assert (await client.get("/api/v1/exercises/does_not_exist")).status_code == 404


# ─── logging ──────────────────────────────────────────────────────────


async def test_log_workout_idempotent(
    client, db_session, seeded_workouts, make_profile_payload, make_hostel_payload
):
    payload = {
        "date": "2026-06-15",
        "template_id": "bw_hostel_gain_30min",
        "exercises_done": [{"exercise_id": "pushup", "sets_done": 3, "reps_done": [10, 9, 8]}],
        "status": "done",
    }
    r1 = await client.post("/api/v1/logs/workout", json=payload)
    assert r1.status_code == 201
    # Re-submit same day/template with a different status → updates, no duplicate.
    payload["status"] = "partial"
    r2 = await client.post("/api/v1/logs/workout", json=payload)
    assert r2.status_code == 201
    assert r2.json()["status"] == "partial"

    count = (
        await db_session.execute(
            text(
                "SELECT count(*) FROM workout_logs "
                "WHERE template_id = 'bw_hostel_gain_30min' AND user_id = :uid"
            ),
            {"uid": "00000000-0000-0000-0000-000000000001"},
        )
    ).scalar()
    assert count == 1
