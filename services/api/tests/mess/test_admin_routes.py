"""Integration tests for admin-only mess management routes.

Covers the three meaningful cases for every admin route:
  - No auth            → 401 or 422  (missing/invalid Authorization header)
  - Regular user       → 403         (authenticated but role != 'admin')
  - Admin user         → 200         (authenticated + role == 'admin')

Teaching note — why we test at this level instead of mocking:
  The security contract is "only admin users can mutate mess data."
  A unit test that mocks the DB would not catch a missing Depends() call
  in the route signature. An integration test that hits the real FastAPI
  app (in-process) with a real DB catches exactly that.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


# ─── helpers ──────────────────────────────────────────────────────────


def _mess_payload(**overrides) -> dict:
    """Unique mess payload so repeated test runs don't hit the unique constraint."""
    base = {
        "name": f"Test Mess {uuid.uuid4().hex[:8]}",
        "college": "Amrita University CB",
        "city": "Coimbatore",
    }
    base.update(overrides)
    return base


def _dish_payload(**overrides) -> dict:
    """Minimal valid dish payload."""
    base = {
        "name": f"Test Dish {uuid.uuid4().hex[:8]}",
        "category": "other",
        "default_serving_unit": "katori",
        "default_serving_grams": 150.0,
        "kcal": 200.0,
        "protein_g": 5.0,
        "carbs_g": 40.0,
        "fats_g": 2.0,
    }
    base.update(overrides)
    return base


# ─── POST /mess/admin/messes ──────────────────────────────────────────


class TestCreateMess:
    async def test_no_auth_rejected(self, unauthed_client: AsyncClient):
        r = await unauthed_client.post("/mess/admin/messes", json=_mess_payload())
        assert r.status_code in (401, 422)

    async def test_regular_user_gets_403(self, client: AsyncClient):
        # client fixture injects a user with role='user' (the default)
        r = await client.post("/mess/admin/messes", json=_mess_payload())
        assert r.status_code == 403
        assert "admin" in r.json()["detail"].lower()

    async def test_admin_can_create_mess(self, admin_client: AsyncClient):
        payload = _mess_payload()
        r = await admin_client.post("/mess/admin/messes", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == payload["name"]
        assert body["college"] == payload["college"]
        assert "id" in body

    async def test_created_mess_is_listable(self, admin_client: AsyncClient):
        payload = _mess_payload()
        create = await admin_client.post("/mess/admin/messes", json=payload)
        assert create.status_code == 200

        list_r = await admin_client.get("/mess/messes")
        assert list_r.status_code == 200
        names = [m["name"] for m in list_r.json()]
        assert payload["name"] in names


# ─── POST /mess/admin/dishes ──────────────────────────────────────────


class TestCreateDish:
    async def test_no_auth_rejected(self, unauthed_client: AsyncClient):
        r = await unauthed_client.post("/mess/admin/dishes", json=_dish_payload())
        assert r.status_code in (401, 422)

    async def test_regular_user_gets_403(self, client: AsyncClient):
        r = await client.post("/mess/admin/dishes", json=_dish_payload())
        assert r.status_code == 403

    async def test_admin_can_create_dish(self, admin_client: AsyncClient):
        payload = _dish_payload()
        r = await admin_client.post("/mess/admin/dishes", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == payload["name"]
        assert body["kcal"] == payload["kcal"]
        assert "id" in body

    async def test_created_dish_appears_in_list(self, admin_client: AsyncClient):
        payload = _dish_payload()
        create = await admin_client.post("/mess/admin/dishes", json=payload)
        assert create.status_code == 200

        list_r = await admin_client.get(f"/mess/dishes?query={payload['name']}")
        assert list_r.status_code == 200
        names = [d["name"] for d in list_r.json()]
        assert payload["name"] in names
