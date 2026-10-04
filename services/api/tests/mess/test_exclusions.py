"""Integration tests for dish exclusion endpoints.

Covers:
- GET returns empty list before any exclusions
- POST creates an exclusion; GET returns it
- POST is idempotent (same payload twice → same row, not a 409)
- DELETE removes the exclusion; GET returns empty list again
- DELETE is a no-op when the exclusion doesn't exist (204, not 404)
- Exclusions are user-scoped: row owner matches the JWT user_id
- Unauthenticated requests → 401/422
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


TODAY = "2026-06-01"
MEAL = "lunch"


def _exclusion_payload(dish_id: str) -> dict:
    return {"date": TODAY, "meal_type": MEAL, "dish_id": dish_id}


@pytest.fixture
def fake_dish_id() -> str:
    return str(uuid.UUID("00000000-dead-beef-0000-000000000001"))


class TestUnauthed:
    async def test_get_exclusions_requires_auth(self, unauthed_client: AsyncClient):
        r = await unauthed_client.get(f"/mess/menu/exclusions?date={TODAY}")
        assert r.status_code == 401

    async def test_post_exclusion_requires_auth(
        self, unauthed_client: AsyncClient, fake_dish_id: str
    ):
        r = await unauthed_client.post(
            "/mess/menu/exclusions", json=_exclusion_payload(fake_dish_id)
        )
        assert r.status_code == 401


class TestExclusionCRUD:
    async def _seed_dish(self, admin_client: AsyncClient) -> str:
        """Create a dish via the admin API and return its UUID."""
        payload = {
            "name": f"TestDish-{uuid.uuid4().hex[:8]}",
            "category": "other",
            "diet_type": "veg",
            "default_serving_unit": "katori",
            "default_serving_grams": 100.0,
            "kcal": 200.0,
            "protein_g": 5.0,
            "carbs_g": 30.0,
            "fats_g": 4.0,
        }
        r = await admin_client.post("/mess/admin/dishes", json=payload)
        assert r.status_code == 200, r.text
        return r.json()["id"]

    async def test_get_returns_empty_before_any_exclusion(self, client: AsyncClient):
        r = await client.get(f"/mess/menu/exclusions?date={TODAY}")
        assert r.status_code == 200
        assert r.json() == []

    async def test_post_creates_exclusion(self, client: AsyncClient, admin_client: AsyncClient):
        dish_id = await self._seed_dish(admin_client)
        r = await client.post("/mess/menu/exclusions", json=_exclusion_payload(dish_id))
        assert r.status_code == 201
        body = r.json()
        assert body["dish_id"] == dish_id
        assert body["meal_type"] == MEAL
        assert body["date"] == TODAY

    async def test_get_returns_exclusion_after_post(
        self, client: AsyncClient, admin_client: AsyncClient
    ):
        dish_id = await self._seed_dish(admin_client)
        await client.post("/mess/menu/exclusions", json=_exclusion_payload(dish_id))
        r = await client.get(f"/mess/menu/exclusions?date={TODAY}")
        assert r.status_code == 200
        ids = [e["dish_id"] for e in r.json()]
        assert dish_id in ids

    async def test_post_is_idempotent(self, client: AsyncClient, admin_client: AsyncClient):
        dish_id = await self._seed_dish(admin_client)
        payload = _exclusion_payload(dish_id)
        r1 = await client.post("/mess/menu/exclusions", json=payload)
        r2 = await client.post("/mess/menu/exclusions", json=payload)
        assert r1.status_code == 201
        assert r2.status_code == 201
        # Only one row should exist
        r = await client.get(f"/mess/menu/exclusions?date={TODAY}")
        found = [e for e in r.json() if e["dish_id"] == dish_id and e["meal_type"] == MEAL]
        assert len(found) == 1

    async def test_delete_removes_exclusion(self, client: AsyncClient, admin_client: AsyncClient):
        dish_id = await self._seed_dish(admin_client)
        await client.post("/mess/menu/exclusions", json=_exclusion_payload(dish_id))
        r = await client.delete(
            f"/mess/menu/exclusions/{dish_id}",
            params={"date": TODAY, "meal_type": MEAL},
        )
        assert r.status_code == 204
        r2 = await client.get(f"/mess/menu/exclusions?date={TODAY}")
        ids = [e["dish_id"] for e in r2.json()]
        assert dish_id not in ids

    async def test_delete_nonexistent_is_noop(self, client: AsyncClient):
        r = await client.delete(
            f"/mess/menu/exclusions/{uuid.uuid4()}",
            params={"date": TODAY, "meal_type": MEAL},
        )
        assert r.status_code == 204


class TestUserScoping:
    async def test_exclusion_row_belongs_to_creating_user(
        self,
        admin_client: AsyncClient,
        db_session: AsyncSession,
        seed_admin_user: str,
        fake_user_id: str,
    ):
        """The inserted row must carry the creating user's ID, not any other user's.

        Note: we verify this at the DB level rather than by making a request as a
        second user. Using both `client` and `admin_client` in the same test causes
        a fixture collision: both write to app.dependency_overrides[get_current_user_id]
        and the last one wins, making the comparison meaningless.
        """
        payload = {
            "name": f"ScopeDish-{uuid.uuid4().hex[:8]}",
            "category": "other",
            "diet_type": "veg",
            "default_serving_unit": "katori",
            "default_serving_grams": 80.0,
            "kcal": 150.0,
            "protein_g": 3.0,
            "carbs_g": 20.0,
            "fats_g": 2.0,
        }
        r = await admin_client.post("/mess/admin/dishes", json=payload)
        dish_id = r.json()["id"]

        await admin_client.post("/mess/menu/exclusions", json=_exclusion_payload(dish_id))

        # The exclusion row must belong to admin — not to the regular test user.
        result = await db_session.execute(
            text(
                "SELECT user_id::text FROM dish_exclusions "
                "WHERE dish_id = :dish_id AND date = :date AND meal_type = :meal_type"
            ),
            {"dish_id": dish_id, "date": date.fromisoformat(TODAY), "meal_type": MEAL},
        )
        rows = result.fetchall()
        assert len(rows) == 1
        assert rows[0].user_id == seed_admin_user
        assert rows[0].user_id != fake_user_id
