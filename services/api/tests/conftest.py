"""Shared pytest configuration + fixtures.

Lives at the test-suite root so every test file picks it up.
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from collections.abc import AsyncIterator
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import NullPool, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import messfit_api.db as db_module
from messfit_api.auth.deps import get_current_user_id
from messfit_api.config import settings
from messfit_api.main import app


# Windows + asyncpg + SSL has a long-standing crash on the default
# Proactor event loop. The Selector loop avoids it.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


# Test engine: NullPool so connections are torn down between tests
# (avoids "Event loop is closed" when a pooled connection outlives the
# loop that created it). Don't share with the production engine.
_test_engine = create_async_engine(
    settings.database_url,
    poolclass=NullPool,
    pool_pre_ping=True,
)
_TestSessionLocal = async_sessionmaker(
    _test_engine, expire_on_commit=False, class_=AsyncSession
)


# Replace the production session factory with the test one for the
# whole test session.
db_module.SessionLocal = _TestSessionLocal


# ─── auth override ────────────────────────────────────────────────────


@pytest.fixture
def fake_user_id() -> str:
    """A stable UUID used to simulate the authed user in API tests."""
    return "00000000-0000-0000-0000-000000000001"


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    """Plain DB session for direct DB assertions/cleanup."""
    async with _TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def seed_test_user(
    db_session: AsyncSession, fake_user_id: str
) -> AsyncIterator[str]:
    """Create the test user row that ``profiles.user_id`` will FK to.

    Cleans up after the test so the suite stays idempotent.
    """
    email = f"test+{uuid.uuid4().hex[:8]}@messfit.local"
    await db_session.execute(
        text(
            "INSERT INTO users (id, email) VALUES (:id, :email) "
            "ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email"
        ),
        {"id": fake_user_id, "email": email},
    )
    await db_session.commit()

    yield fake_user_id

    # Cleanup — delete the test user; CASCADE removes their profile/hostel rows.
    await db_session.execute(
        text("DELETE FROM users WHERE id = :id"), {"id": fake_user_id}
    )
    await db_session.commit()


@pytest_asyncio.fixture
async def client(seed_test_user: str) -> AsyncIterator[AsyncClient]:
    """HTTP client that talks to the live FastAPI app in-process.

    Replaces the auth dependency so every request is treated as
    ``seed_test_user``. Real Supabase JWT verification is skipped here —
    it has its own (much smaller) test surface in PR 0's auth module.
    """

    def _fake_user() -> str:
        return seed_test_user

    app.dependency_overrides[get_current_user_id] = _fake_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.pop(get_current_user_id, None)


@pytest_asyncio.fixture
async def unauthed_client() -> AsyncIterator[AsyncClient]:
    """HTTP client without auth override — useful for testing 401/422 paths."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ─── admin fixtures ───────────────────────────────────────────────────


@pytest.fixture
def fake_admin_id() -> str:
    """A stable UUID used to simulate an admin user in API tests."""
    return "00000000-0000-0000-0000-000000000002"


@pytest_asyncio.fixture
async def seed_admin_user(
    db_session: AsyncSession, fake_admin_id: str
) -> AsyncIterator[str]:
    """Create a user row with role='admin' for testing admin-gated routes."""
    email = f"admin+{uuid.uuid4().hex[:8]}@messfit.local"
    await db_session.execute(
        text(
            "INSERT INTO users (id, email, role) VALUES (:id, :email, 'admin') "
            "ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'admin'"
        ),
        {"id": fake_admin_id, "email": email},
    )
    await db_session.commit()

    yield fake_admin_id

    await db_session.execute(
        text("DELETE FROM users WHERE id = :id"), {"id": fake_admin_id}
    )
    await db_session.commit()


@pytest_asyncio.fixture
async def admin_client(seed_admin_user: str) -> AsyncIterator[AsyncClient]:
    """HTTP client whose requests are treated as the seeded admin user."""

    def _fake_admin() -> str:
        return seed_admin_user

    app.dependency_overrides[get_current_user_id] = _fake_admin

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.pop(get_current_user_id, None)


# ─── helpers ──────────────────────────────────────────────────────────


def valid_profile_payload(**overrides: Any) -> dict[str, Any]:
    """A known-good ProfileIn payload; tweak fields with kwargs."""
    base: dict[str, Any] = {
        "dob": "2005-06-15",
        "sex": "male",
        "height_cm": 175,
        "current_weight_kg": 60,
        "target_weight_kg": 70,
        "target_rate_kg_per_week": 0.25,
        "goal": "gain",
        "activity_level": 3,
        "diet_type": "veg",
        "allergies": [],
        "conditions": [],
    }
    base.update(overrides)
    return base


def valid_hostel_payload(**overrides: Any) -> dict[str, Any]:
    """A known-good HostelContextIn payload."""
    base: dict[str, Any] = {
        "mess_id": None,
        "canteen_freq": "rare",
        "canteen_typical_spend_inr": 50,
        "top_up_budget_inr_weekly": 300,
        "equipment": ["bodyweight"],
        "workout_minutes_per_day": 30,
        "workout_days_per_week": 4,
        "gym_access_days": [],
    }
    base.update(overrides)
    return base


# Make helpers usable as pytest fixtures too
@pytest.fixture
def make_profile_payload():
    return valid_profile_payload


@pytest.fixture
def make_hostel_payload():
    return valid_hostel_payload
