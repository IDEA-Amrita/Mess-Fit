"""Tests for GET /api/v1/logs/progress (Phase 6, task 6.4).

Sets up a real profile (so targets compute) and seeds a few days of weight + meal
logs through the API, then asserts the aggregated progress shape + metrics.
"""

from __future__ import annotations

import datetime as dt

from messfit_api.tracking.time import today_ist


async def test_progress_409_without_profile(client):
    assert (await client.get("/api/v1/logs/progress")).status_code == 409


async def test_progress_aggregates(client, make_profile_payload):
    await client.put("/api/v1/profile/me", json=make_profile_payload(goal="gain"))

    today = today_ist()
    # 6 ascending weigh-ins → projection available; meals as_planned with snapshots.
    for i in range(6):
        d = (today - dt.timedelta(days=5 - i)).isoformat()
        await client.post(
            "/api/v1/logs/weight", json={"date": d, "weight_kg": 60 + 0.2 * i}
        )
        await client.post(
            "/api/v1/logs/meals",
            json={
                "date": d,
                "meal_type": "lunch",
                "status": "as_planned",
                "kcal": 700,
                "protein_g": 40,
                "carbs_g": 90,
                "fats_g": 20,
            },
        )

    body = (await client.get("/api/v1/logs/progress?range=30d")).json()
    assert body["range"] == "30d"
    assert len(body["weight_series"]) == 6
    assert 0.0 <= body["adherence_rate"] <= 1.0
    assert body["macro_hit_rate"] is not None
    assert body["projection"]["available"] is True
    assert isinstance(body["streak_days"], int)


async def test_progress_macro_hit_none_without_snapshots(client, make_profile_payload):
    await client.put("/api/v1/profile/me", json=make_profile_payload())
    today = today_ist().isoformat()
    await client.post(
        "/api/v1/logs/meals",
        json={"date": today, "meal_type": "dinner", "status": "skipped"},
    )
    body = (await client.get("/api/v1/logs/progress")).json()
    assert body["macro_hit_rate"] is None
