"""Integration tests for the three public mess read routes.

  GET /mess/messes
  GET /mess/dishes
  GET /mess/messes/{mess_id}/menu

All three require no authentication — any client (logged in or not) can call them.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


# ─── payload helpers ──────────────────────────────────────────────────


def _mess_payload(**overrides) -> dict:
    return {
        "name": f"TestMess-{uuid.uuid4().hex[:8]}",
        "college": "Amrita CB",
        "city": "Coimbatore",
        **overrides,
    }


def _dish_payload(**overrides) -> dict:
    return {
        "name": f"TestDish-{uuid.uuid4().hex[:8]}",
        "category": "other",
        "default_serving_unit": "katori",
        "default_serving_grams": 100.0,
        "kcal": 200.0,
        "protein_g": 5.0,
        "carbs_g": 30.0,
        "fats_g": 4.0,
        **overrides,
    }


# ─── GET /mess/messes ─────────────────────────────────────────────────


class TestListMesses:
    async def test_returns_200_and_list(self, unauthed_client: AsyncClient):
        r = await unauthed_client.get("/mess/messes")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_created_mess_appears_in_list(
        self, admin_client: AsyncClient, unauthed_client: AsyncClient
    ):
        payload = _mess_payload()
        create = await admin_client.post("/mess/admin/messes", json=payload)
        assert create.status_code == 200

        r = await unauthed_client.get("/mess/messes")
        assert r.status_code == 200
        assert payload["name"] in [m["name"] for m in r.json()]

    async def test_response_shape(
        self, admin_client: AsyncClient, unauthed_client: AsyncClient
    ):
        await admin_client.post("/mess/admin/messes", json=_mess_payload())
        r = await unauthed_client.get("/mess/messes")
        for m in r.json():
            assert {"id", "name", "college", "city"} <= m.keys()


# ─── GET /mess/dishes ─────────────────────────────────────────────────


class TestListDishes:
    async def test_returns_200_and_list(self, unauthed_client: AsyncClient):
        r = await unauthed_client.get("/mess/dishes")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_query_filter_finds_dish(
        self, admin_client: AsyncClient, unauthed_client: AsyncClient
    ):
        payload = _dish_payload()
        await admin_client.post("/mess/admin/dishes", json=payload)

        r = await unauthed_client.get(f"/mess/dishes?query={payload['name']}")
        assert r.status_code == 200
        assert payload["name"] in [d["name"] for d in r.json()]

    async def test_query_no_match_returns_empty(self, unauthed_client: AsyncClient):
        r = await unauthed_client.get("/mess/dishes?query=ZZZNO_MATCH_DISH_XYZ99999")
        assert r.status_code == 200
        assert r.json() == []

    async def test_limit_caps_results(
        self, admin_client: AsyncClient, unauthed_client: AsyncClient
    ):
        prefix = f"LimitDish-{uuid.uuid4().hex[:8]}"
        for i in range(3):
            await admin_client.post(
                "/mess/admin/dishes", json=_dish_payload(name=f"{prefix}-{i}")
            )
        r = await unauthed_client.get(f"/mess/dishes?query={prefix}&limit=2")
        assert r.status_code == 200
        assert len(r.json()) <= 2

    async def test_response_shape(
        self, admin_client: AsyncClient, unauthed_client: AsyncClient
    ):
        payload = _dish_payload()
        await admin_client.post("/mess/admin/dishes", json=payload)

        r = await unauthed_client.get(f"/mess/dishes?query={payload['name']}")
        assert r.status_code == 200
        d = r.json()[0]
        for field in ("id", "name", "category", "kcal", "protein_g", "carbs_g", "fats_g"):
            assert field in d


# ─── GET /mess/messes/{mess_id}/menu ─────────────────────────────────


class TestDailyMenu:
    async def _create_mess(self, admin_client: AsyncClient) -> str:
        r = await admin_client.post("/mess/admin/messes", json=_mess_payload())
        assert r.status_code == 200, r.text
        return r.json()["id"]

    async def test_returns_200_for_valid_mess(
        self, admin_client: AsyncClient, unauthed_client: AsyncClient
    ):
        mess_id = await self._create_mess(admin_client)
        r = await unauthed_client.get(f"/mess/messes/{mess_id}/menu")
        assert r.status_code == 200

    async def test_response_has_required_keys(
        self, admin_client: AsyncClient, unauthed_client: AsyncClient
    ):
        mess_id = await self._create_mess(admin_client)
        r = await unauthed_client.get(f"/mess/messes/{mess_id}/menu")
        body = r.json()
        for key in ("date", "day_of_week", "breakfast", "lunch", "snack", "dinner"):
            assert key in body

    async def test_empty_mess_returns_empty_meals(
        self, admin_client: AsyncClient, unauthed_client: AsyncClient
    ):
        """A mess with no menu entries must return empty lists, not 404."""
        mess_id = await self._create_mess(admin_client)
        r = await unauthed_client.get(f"/mess/messes/{mess_id}/menu")
        body = r.json()
        assert body["breakfast"] == []
        assert body["lunch"] == []
        assert body["snack"] == []
        assert body["dinner"] == []

    async def test_date_param_sets_date_and_day_of_week(
        self, admin_client: AsyncClient, unauthed_client: AsyncClient
    ):
        """?date= drives both `date` and `day_of_week` in the response.

        2026-01-05 is a Monday → day_of_week == 0.
        """
        mess_id = await self._create_mess(admin_client)
        r = await unauthed_client.get(f"/mess/messes/{mess_id}/menu?date=2026-01-05")
        assert r.status_code == 200
        body = r.json()
        assert body["date"] == "2026-01-05"
        assert body["day_of_week"] == 0  # Monday

    async def test_invalid_uuid_returns_422(self, unauthed_client: AsyncClient):
        r = await unauthed_client.get("/mess/messes/not-a-valid-uuid/menu")
        assert r.status_code == 422

    async def test_no_auth_required(
        self, admin_client: AsyncClient, unauthed_client: AsyncClient
    ):
        """Menu is public — no Authorization header needed."""
        mess_id = await self._create_mess(admin_client)
        r = await unauthed_client.get(f"/mess/messes/{mess_id}/menu")
        assert r.status_code == 200
