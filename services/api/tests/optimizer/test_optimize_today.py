"""Integration tests for POST /api/v1/optimize/today.

All tests use the live FastAPI app and a real DB (same as other integration
tests in this suite).  ``run_optimizer`` is monkeypatched in every test so
no Celery broker or Redis instance is required.

DB seeding for mess / dish / menu rows is done with raw SQL (same pattern
as conftest.py's user seeding) because those tables have no user-facing
write API that is accessible without RLS and an admin JWT.
"""

from __future__ import annotations

import datetime
import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

URL = "/api/v1/optimize/today"

# A minimal but valid OptimizationOutput dict (what run_optimizer returns).
_FAKE_RESULT: dict = {
    "plan": {
        "lunch": [
            {
                "dish_id": "test-dish-id",
                "name": "Dal",
                "portions": 1.5,
                "serving_unit": "katori",
                "portion_icon": "katori",
                "grams": 225.0,
                "kcal": 180.0,
                "protein_g": 12.0,
                "carbs_g": 27.0,
                "fats_g": 3.0,
                "reason": "Top protein source in this meal",
            }
        ]
    },
    "daily_totals": {"kcal": 180.0, "protein_g": 12.0, "carbs_g": 27.0, "fats_g": 3.0},
    "daily_targets": {"kcal": 2000.0, "protein_g": 96.0, "carbs_g": 220.0, "fats_g": 55.0},
    "gap_fills": [],
    "solver_status": "Optimal",
    "solve_time_ms": 55,
}


# ── fixtures ───────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def seeded_state(
    db_session: AsyncSession,
    seed_test_user: str,
    client: AsyncClient,
    make_profile_payload,
    make_hostel_payload,
):
    """Full DB state: profile, hostel, mess, dish, and a menu entry for today."""
    mess_id = uuid.uuid4()
    dish_id = uuid.uuid4()
    menu_id = uuid.uuid4()
    today = datetime.date.today()
    dow = today.weekday()

    await db_session.execute(
        text(
            "INSERT INTO messes (id, name, college, city) "
            "VALUES (:id, :name, :college, :city)"
        ),
        {"id": str(mess_id), "name": f"TestMess-{mess_id.hex[:8]}", "college": "Test College", "city": "Test City"},
    )
    await db_session.execute(
        text(
            "INSERT INTO dishes "
            "(id, name, category, diet_type, default_serving_unit, "
            " default_serving_grams, kcal, protein_g, carbs_g, fats_g) "
            "VALUES (:id, :name, :cat, :dt, :unit, :grams, :kcal, :prot, :carbs, :fats)"
        ),
        {
            "id": str(dish_id),
            "name": f"TestDish-{dish_id.hex[:8]}",
            "cat": "dal",
            "dt": "veg",
            "unit": "katori",
            "grams": 150.0,
            "kcal": 120.0,
            "prot": 8.0,
            "carbs": 18.0,
            "fats": 2.0,
        },
    )
    await db_session.execute(
        text(
            "INSERT INTO mess_menus "
            "(id, mess_id, effective_from, day_of_week, meal_type, dish_id) "
            "VALUES (:id, :mess_id, :from_date, :dow, :meal, :dish_id)"
        ),
        {
            "id": str(menu_id),
            "mess_id": str(mess_id),
            "from_date": datetime.date(2026, 1, 1),
            "dow": dow,
            "meal": "lunch",
            "dish_id": str(dish_id),
        },
    )
    await db_session.commit()

    # Profile and hostel context via the real API (exercises those routes too).
    r = await client.put("/api/v1/profile/me", json=make_profile_payload())
    assert r.status_code == 200, r.text
    r = await client.put(
        "/api/v1/profile/hostel-context",
        json=make_hostel_payload(mess_id=str(mess_id)),
    )
    assert r.status_code == 200, r.text

    yield {"mess_id": mess_id, "dish_id": dish_id}

    # hostel_contexts.mess_id → messes.id is ON DELETE RESTRICT.
    # Null it out first so the FK allows the mess deletion below.
    await db_session.execute(
        text("UPDATE hostel_contexts SET mess_id = NULL WHERE mess_id = :id"),
        {"id": str(mess_id)},
    )
    await db_session.execute(
        text("DELETE FROM mess_menus WHERE id = :id"), {"id": str(menu_id)}
    )
    await db_session.execute(
        text("DELETE FROM messes WHERE id = :id"), {"id": str(mess_id)}
    )
    await db_session.execute(
        text("DELETE FROM dishes WHERE id = :id"), {"id": str(dish_id)}
    )
    await db_session.commit()


# ── unauthenticated ────────────────────────────────────────────────────


class TestUnauthed:
    async def test_no_auth_header_rejected(self, unauthed_client: AsyncClient):
        r = await unauthed_client.post(URL)
        assert r.status_code in (401, 422)


# ── error paths: incomplete onboarding ────────────────────────────────


class TestOnboardingErrors:
    async def test_no_profile_returns_409(self, client: AsyncClient):
        r = await client.post(URL)
        assert r.status_code == 409
        assert "profile" in r.json()["detail"].lower()

    async def test_no_hostel_context_returns_409(
        self, client: AsyncClient, make_profile_payload, seed_test_user: str
    ):
        await client.put("/api/v1/profile/me", json=make_profile_payload())
        r = await client.post(URL)
        assert r.status_code == 409
        assert "hostel" in r.json()["detail"].lower()

    async def test_no_mess_configured_returns_409(
        self,
        client: AsyncClient,
        make_profile_payload,
        make_hostel_payload,
        seed_test_user: str,
    ):
        await client.put("/api/v1/profile/me", json=make_profile_payload())
        await client.put(
            "/api/v1/profile/hostel-context",
            json=make_hostel_payload(mess_id=None),
        )
        r = await client.post(URL)
        assert r.status_code == 409
        assert "mess" in r.json()["detail"].lower()

    async def test_no_menu_for_today_returns_409(
        self,
        db_session: AsyncSession,
        client: AsyncClient,
        make_profile_payload,
        make_hostel_payload,
        seed_test_user: str,
    ):
        """A mess with no menu entry for today's day_of_week triggers 409."""
        mess_id = uuid.uuid4()
        await db_session.execute(
            text(
                "INSERT INTO messes (id, name, college, city) "
                "VALUES (:id, :name, :college, :city)"
            ),
            {"id": str(mess_id), "name": f"EmptyMess-{mess_id.hex[:8]}", "college": "Test", "city": "Test"},
        )
        await db_session.commit()

        await client.put("/api/v1/profile/me", json=make_profile_payload())
        await client.put(
            "/api/v1/profile/hostel-context",
            json=make_hostel_payload(mess_id=str(mess_id)),
        )

        r = await client.post(URL)
        assert r.status_code == 409
        assert "menu" in r.json()["detail"].lower()

        # hostel_contexts.mess_id → messes.id is ON DELETE RESTRICT.
        # Null it out first so the FK allows mess deletion.
        await db_session.execute(
            text("UPDATE hostel_contexts SET mess_id = NULL WHERE mess_id = :id"),
            {"id": str(mess_id)},
        )
        await db_session.execute(
            text("DELETE FROM messes WHERE id = :id"), {"id": str(mess_id)}
        )
        await db_session.commit()


# ── happy path ─────────────────────────────────────────────────────────


class TestHappyPath:
    async def test_returns_200_with_plan(
        self, client: AsyncClient, seeded_state: dict, monkeypatch
    ):
        monkeypatch.setattr(
            "messfit_api.optimizer.routes.run_optimizer",
            lambda _payload: _FAKE_RESULT,
        )
        r = await client.post(URL)
        assert r.status_code == 200, r.text

        body = r.json()
        assert "plan" in body
        assert "daily_totals" in body
        assert "daily_targets" in body
        assert "solver_status" in body

    async def test_response_plan_has_meal_dishes(
        self, client: AsyncClient, seeded_state: dict, monkeypatch
    ):
        monkeypatch.setattr(
            "messfit_api.optimizer.routes.run_optimizer",
            lambda _payload: _FAKE_RESULT,
        )
        r = await client.post(URL)
        assert r.status_code == 200, r.text

        plan = r.json()["plan"]
        assert "lunch" in plan
        assert len(plan["lunch"]) > 0
        item = plan["lunch"][0]
        for field in ("dish_id", "name", "portions", "kcal", "protein_g", "reason"):
            assert field in item

    async def test_solver_receives_correct_input_shape(
        self, client: AsyncClient, seeded_state: dict, monkeypatch
    ):
        """Verify the payload reaching run_optimizer has the expected structure."""
        received: list[dict] = []

        def _capture(payload: dict) -> dict:
            received.append(payload)
            return _FAKE_RESULT

        monkeypatch.setattr("messfit_api.optimizer.routes.run_optimizer", _capture)

        r = await client.post(URL)
        assert r.status_code == 200, r.text
        assert len(received) == 1

        payload = received[0]
        assert "daily_kcal" in payload
        assert "menu" in payload
        assert "lunch" in payload["menu"]
        assert len(payload["menu"]["lunch"]) == 1

        dish = payload["menu"]["lunch"][0]
        assert dish["diet_type"] == "veg"
        assert dish["category"] == "dal"
