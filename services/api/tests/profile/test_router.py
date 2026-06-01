"""Integration tests for the profile router.

These hit the live FastAPI app (in-process) and a real Supabase DB.
They cover the happy path and the most important failure modes:

- 401 without auth
- 404 when fetching a profile that doesn't exist
- 200 round-trip on PUT then GET
- 200 with the right macros from /targets
- 422 on bad input (Pydantic validation)
- 409 on /targets when the profile isn't set up
- 200 idempotent upsert (PUT twice should not create duplicates)
- onboarded_at stamped on first hostel-context save, not overwritten later
"""

from __future__ import annotations

from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# ─── 401: no auth ─────────────────────────────────────────────────────


class TestUnauthed:
    async def test_get_me_requires_auth(self, unauthed_client: AsyncClient):
        r = await unauthed_client.get("/api/v1/profile/me")
        # FastAPI's default for missing header is 422; our auth dep
        # explicitly raises 401 only after seeing the header. Either is
        # fine — 401 is the spec-correct one for missing auth.
        assert r.status_code in (401, 422)


# ─── /me ──────────────────────────────────────────────────────────────


class TestProfileMe:
    async def test_get_me_returns_404_when_no_profile(self, client: AsyncClient):
        r = await client.get("/api/v1/profile/me")
        assert r.status_code == 404
        assert "onboarding" in r.json()["detail"].lower()

    async def test_put_then_get_roundtrip(
        self, client: AsyncClient, make_profile_payload
    ):
        payload = make_profile_payload()
        put = await client.put("/api/v1/profile/me", json=payload)
        assert put.status_code == 200, put.text
        body = put.json()
        assert body["height_cm"] == 175.0
        assert body["goal"] == "gain"
        assert body["allergies"] == []

        got = await client.get("/api/v1/profile/me")
        assert got.status_code == 200
        assert got.json()["height_cm"] == 175.0

    async def test_put_idempotent(self, client: AsyncClient, make_profile_payload):
        # Two PUTs — second is an update, not a duplicate insert.
        await client.put("/api/v1/profile/me", json=make_profile_payload())
        r = await client.put(
            "/api/v1/profile/me",
            json=make_profile_payload(current_weight_kg=62),
        )
        assert r.status_code == 200
        assert r.json()["current_weight_kg"] == 62.0

    async def test_put_rejects_bad_height(
        self, client: AsyncClient, make_profile_payload
    ):
        r = await client.put(
            "/api/v1/profile/me", json=make_profile_payload(height_cm=50)
        )
        assert r.status_code == 422

    async def test_put_rejects_bad_goal(
        self, client: AsyncClient, make_profile_payload
    ):
        r = await client.put(
            "/api/v1/profile/me", json=make_profile_payload(goal="shred")
        )
        assert r.status_code == 422

    async def test_put_rejects_bad_diet(
        self, client: AsyncClient, make_profile_payload
    ):
        r = await client.put(
            "/api/v1/profile/me", json=make_profile_payload(diet_type="carnivore")
        )
        assert r.status_code == 422

    async def test_put_rejects_aggressive_weight_rate(
        self, client: AsyncClient, make_profile_payload
    ):
        r = await client.put(
            "/api/v1/profile/me",
            json=make_profile_payload(target_rate_kg_per_week=1.0),
        )
        assert r.status_code == 422


# ─── /hostel-context ──────────────────────────────────────────────────


class TestHostelContext:
    async def test_get_returns_404_when_not_set(self, client: AsyncClient):
        r = await client.get("/api/v1/profile/hostel-context")
        assert r.status_code == 404

    async def test_put_then_get_roundtrip(
        self, client: AsyncClient, make_hostel_payload
    ):
        put = await client.put(
            "/api/v1/profile/hostel-context", json=make_hostel_payload()
        )
        assert put.status_code == 200, put.text
        assert put.json()["canteen_freq"] == "rare"

        got = await client.get("/api/v1/profile/hostel-context")
        assert got.status_code == 200
        assert got.json()["equipment"] == ["bodyweight"]

    async def test_put_idempotent(self, client: AsyncClient, make_hostel_payload):
        await client.put("/api/v1/profile/hostel-context", json=make_hostel_payload())
        r = await client.put(
            "/api/v1/profile/hostel-context",
            json=make_hostel_payload(canteen_freq="frequent"),
        )
        assert r.status_code == 200
        assert r.json()["canteen_freq"] == "frequent"

    async def test_put_rejects_bad_canteen_freq(
        self, client: AsyncClient, make_hostel_payload
    ):
        r = await client.put(
            "/api/v1/profile/hostel-context",
            json=make_hostel_payload(canteen_freq="hourly"),
        )
        assert r.status_code == 422

    async def test_put_stamps_onboarded_at(
        self,
        client: AsyncClient,
        make_hostel_payload,
        db_session: AsyncSession,
        fake_user_id: str,
    ):
        """First PUT to hostel-context must stamp users.onboarded_at."""
        await client.put("/api/v1/profile/hostel-context", json=make_hostel_payload())
        row = (
            await db_session.execute(
                text("SELECT onboarded_at FROM users WHERE id = :id"),
                {"id": fake_user_id},
            )
        ).first()
        assert row is not None
        assert row.onboarded_at is not None

    async def test_put_does_not_overwrite_onboarded_at(
        self,
        client: AsyncClient,
        make_hostel_payload,
        db_session: AsyncSession,
        fake_user_id: str,
    ):
        """Re-saving hostel context must not change an existing onboarded_at."""
        known_dt = datetime(2024, 1, 1, tzinfo=timezone.utc)
        await db_session.execute(
            text("UPDATE users SET onboarded_at = :ts WHERE id = :id"),
            {"ts": known_dt, "id": fake_user_id},
        )
        await db_session.commit()

        await client.put(
            "/api/v1/profile/hostel-context",
            json=make_hostel_payload(canteen_freq="daily"),
        )

        row = (
            await db_session.execute(
                text("SELECT onboarded_at FROM users WHERE id = :id"),
                {"id": fake_user_id},
            )
        ).first()
        assert row.onboarded_at.year == 2024


# ─── /targets ─────────────────────────────────────────────────────────


class TestTargets:
    async def test_returns_409_when_no_profile(self, client: AsyncClient):
        r = await client.get("/api/v1/profile/targets")
        assert r.status_code == 409

    async def test_returns_targets_after_profile_set(
        self, client: AsyncClient, make_profile_payload
    ):
        await client.put("/api/v1/profile/me", json=make_profile_payload())
        r = await client.get("/api/v1/profile/targets")
        assert r.status_code == 200, r.text

        body = r.json()
        # Expected: 175 cm, 60 kg, gain 0.25 kg/week, activity 3, male
        # protein for gain = 1.6 g/kg = 96 g
        assert body["daily_protein_g"] == 96
        assert body["bmi_class"] == "normal"
        assert body["daily_kcal"] > body["tdee"]  # surplus for gain
        # rationale dict must round-trip through JSON intact
        assert "bmr_formula" in body["rationale"]
        assert body["rationale"]["conditions_applied"] == []

    async def test_targets_reflect_pcos_protein_bump(
        self, client: AsyncClient, make_profile_payload
    ):
        # baseline
        await client.put(
            "/api/v1/profile/me",
            json=make_profile_payload(
                current_weight_kg=60, goal="lose", target_rate_kg_per_week=-0.25
            ),
        )
        baseline = (await client.get("/api/v1/profile/targets")).json()

        # with PCOS — protein should bump by 0.1 g/kg = 6 g for 60 kg body
        await client.put(
            "/api/v1/profile/me",
            json=make_profile_payload(
                current_weight_kg=60,
                goal="lose",
                target_rate_kg_per_week=-0.25,
                conditions=["pcos"],
            ),
        )
        with_pcos = (await client.get("/api/v1/profile/targets")).json()

        assert with_pcos["daily_protein_g"] - baseline["daily_protein_g"] == 6, (
            f"baseline {baseline['daily_protein_g']} pcos {with_pcos['daily_protein_g']}"
        )


# ─── existing endpoints still work (sanity) ───────────────────────────


class TestExistingEndpointsStillWork:
    async def test_health(self, unauthed_client: AsyncClient):
        r = await unauthed_client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    async def test_me_legacy(self, client: AsyncClient, fake_user_id: str):
        # /api/v1/me predates this PR; just confirm we didn't break it.
        r = await client.get("/api/v1/me")
        assert r.status_code == 200
        assert r.json() == {"user_id": fake_user_id}
