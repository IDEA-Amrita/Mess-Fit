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
        "diet_type": "veg",
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


# ─── PATCH /mess/admin/dishes/{id} ─────────────────────────────────────
#
# Exists so an admin can correct allergens/diet_type on a dish the OCR or
# photo-scan pipeline created from an unverified LLM estimate — there was
# previously no way to edit a dish once created.


class TestUpdateDish:
    # These two deliberately use a random, never-created dish id and only
    # the one relevant client fixture: app.dependency_overrides is global
    # (shared across every AsyncClient hitting the same in-process app), so
    # requesting admin_client alongside unauthed_client/client in the same
    # test leaks the admin override onto the "unauthed" request too.
    async def test_no_auth_rejected(self, unauthed_client: AsyncClient):
        r = await unauthed_client.patch(f"/mess/admin/dishes/{uuid.uuid4()}", json={"allergens": ["nuts"]})
        assert r.status_code in (401, 422)

    async def test_regular_user_gets_403(self, client: AsyncClient):
        r = await client.patch(f"/mess/admin/dishes/{uuid.uuid4()}", json={"allergens": ["nuts"]})
        assert r.status_code == 403

    async def test_admin_can_add_allergens_after_creation(self, admin_client: AsyncClient):
        # The exact gap this closes: a draft dish created with allergens=[]
        # (the OCR/photo-scan default before this fix) had no way to be
        # corrected once an admin actually knew what it contained.
        created = await admin_client.post("/mess/admin/dishes", json=_dish_payload(allergens=[]))
        dish_id = created.json()["id"]
        assert created.json()["allergens"] == []

        r = await admin_client.patch(f"/mess/admin/dishes/{dish_id}", json={"allergens": ["eggs", "gluten"]})
        assert r.status_code == 200, r.text
        assert sorted(r.json()["allergens"]) == ["eggs", "gluten"]

        # Persisted, not just echoed back.
        get_r = await admin_client.get(f"/mess/dishes?query={created.json()['name']}")
        assert sorted(get_r.json()[0]["allergens"]) == ["eggs", "gluten"]

    async def test_patch_only_touches_sent_fields(self, admin_client: AsyncClient):
        payload = _dish_payload(diet_type="veg")
        created = await admin_client.post("/mess/admin/dishes", json=payload)
        dish_id = created.json()["id"]

        r = await admin_client.patch(f"/mess/admin/dishes/{dish_id}", json={"diet_type": "egg"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["diet_type"] == "egg"
        # Untouched fields survive the partial update.
        assert body["name"] == payload["name"]
        assert body["kcal"] == payload["kcal"]

    async def test_missing_dish_404s(self, admin_client: AsyncClient):
        r = await admin_client.patch(
            f"/mess/admin/dishes/{uuid.uuid4()}", json={"allergens": ["nuts"]}
        )
        assert r.status_code == 404
