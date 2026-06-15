"""Tests for the logging API endpoints (Phase 6, task 6.2).

The fake user's log rows are CASCADE-removed when the test user is deleted by the
conftest fixture, so no extra cleanup is needed.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from messfit_api.tracking.time import today_ist

# ─── meals ────────────────────────────────────────────────────────────


async def test_log_meal_idempotent(client, db_session: AsyncSession):
    payload = {
        "date": "2026-06-15",
        "meal_type": "lunch",
        "status": "as_planned",
        "kcal": 620.5,
        "protein_g": 30,
        "carbs_g": 80,
        "fats_g": 18,
    }
    r1 = await client.post("/api/v1/logs/meals", json=payload)
    assert r1.status_code == 201
    assert r1.json()["kcal"] == 620.5

    # Re-submit same slot with a different status → updates, no duplicate.
    payload["status"] = "skipped"
    payload["kcal"] = None
    r2 = await client.post("/api/v1/logs/meals", json=payload)
    assert r2.status_code == 201
    assert r2.json()["status"] == "skipped"
    assert r2.json()["kcal"] is None

    count = (
        await db_session.execute(
            text(
                "SELECT count(*) FROM meal_logs "
                "WHERE date = '2026-06-15' AND meal_type = 'lunch' "
                "AND user_id = :uid"
            ),
            {"uid": "00000000-0000-0000-0000-000000000001"},
        )
    ).scalar()
    assert count == 1


async def test_log_meal_rejects_bad_meal_type(client):
    r = await client.post(
        "/api/v1/logs/meals",
        json={"date": "2026-06-15", "meal_type": "brunch", "status": "as_planned"},
    )
    assert r.status_code == 422


# ─── weight ───────────────────────────────────────────────────────────


async def test_log_weight_idempotent(client, db_session: AsyncSession):
    r1 = await client.post(
        "/api/v1/logs/weight", json={"date": "2026-06-15", "weight_kg": 61.2}
    )
    assert r1.status_code == 201
    r2 = await client.post(
        "/api/v1/logs/weight", json={"date": "2026-06-15", "weight_kg": 61.8}
    )
    assert r2.status_code == 201
    assert r2.json()["weight_kg"] == 61.8

    count = (
        await db_session.execute(
            text(
                "SELECT count(*) FROM weight_logs "
                "WHERE date = '2026-06-15' AND user_id = :uid"
            ),
            {"uid": "00000000-0000-0000-0000-000000000001"},
        )
    ).scalar()
    assert count == 1


async def test_log_weight_rejects_out_of_range(client):
    r = await client.post(
        "/api/v1/logs/weight", json={"date": "2026-06-15", "weight_kg": 12}
    )
    assert r.status_code == 422


# ─── subjective ───────────────────────────────────────────────────────


async def test_log_subjective_idempotent(client):
    r1 = await client.post(
        "/api/v1/logs/subjective",
        json={"date": "2026-06-15", "energy": 3, "hunger": 4, "mood": 5},
    )
    assert r1.status_code == 201
    r2 = await client.post(
        "/api/v1/logs/subjective",
        json={"date": "2026-06-15", "energy": 5, "hunger": 2, "mood": 4},
    )
    assert r2.status_code == 201
    assert r2.json()["energy"] == 5


# ─── today ────────────────────────────────────────────────────────────


async def test_today_aggregates_logs(client):
    today = today_ist().isoformat()
    await client.post(
        "/api/v1/logs/meals",
        json={"date": today, "meal_type": "breakfast", "status": "as_planned"},
    )
    await client.post("/api/v1/logs/weight", json={"date": today, "weight_kg": 60})
    await client.post(
        "/api/v1/logs/subjective", json={"date": today, "energy": 4}
    )

    body = (await client.get("/api/v1/logs/today")).json()
    assert body["date"] == today
    assert len(body["meals"]) == 1
    assert body["meals"][0]["meal_type"] == "breakfast"
    assert body["weight"]["weight_kg"] == 60
    assert body["subjective"]["energy"] == 4
    assert body["workout_status"] is None
