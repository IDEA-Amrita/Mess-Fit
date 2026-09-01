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

import json

from fastapi import Depends

import messfit_api.db as db_module
from messfit_api.auth.deps import get_current_user_id
from messfit_api.config import settings
from messfit_api.db import get_session
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

# Worker-equivalent test engine: connects with whatever role bypasses RLS
# (celery_database_url in prod; same as database_url whenever the two
# roles haven't been split, e.g. today's single-role local Postgres — so
# this is a no-op until migration 013's roles are actually provisioned).
# Test scaffolding (seeding a fake user, purging the catalog) is trusted
# maintenance, not a simulated user request, and needs the same
# cross-user access production's Celery tasks get from messfit_worker.
_test_worker_engine = create_async_engine(
    settings.celery_database_url or settings.database_url,
    poolclass=NullPool,
    pool_pre_ping=True,
)
_TestWorkerSessionLocal = async_sessionmaker(
    _test_worker_engine, expire_on_commit=False, class_=AsyncSession
)


# Replace the production session factories with the test ones for the
# whole test session.
db_module.SessionLocal = _TestSessionLocal
db_module.WorkerSessionLocal = _TestWorkerSessionLocal


# Rate limiting uses process-global in-memory storage, so leave it OFF for the
# suite — otherwise rapid-fire tests would trip the limits. The dedicated
# rate-limit test flips it on for its own window.
from messfit_api.observability.ratelimit import limiter as _limiter  # noqa: E402

_limiter.enabled = False


# ─── test-data hygiene ────────────────────────────────────────────────
#
# The suite runs against the shared dev database (same DATABASE_URL as the
# app), so catalog rows created by tests would otherwise leak into the
# app's mess picker. Every test-created mess/dish name must match one of
# these patterns — add new prefixes here if a test introduces one.

_TEST_MESS_PATTERNS = ("TestMess-%", "Test Mess %", "EmptyMess-%")
_TEST_DISH_PATTERNS = ("TestDish-%", "Test Dish %", "ScopeDish-%")


def _like_any(column: str, patterns: tuple[str, ...]) -> tuple[str, dict[str, str]]:
    """Build an OR-of-LIKEs clause and its bind params."""
    clauses = " OR ".join(
        f"{column} LIKE :{column}_p{i}" for i in range(len(patterns))
    )
    params = {f"{column}_p{i}": p for i, p in enumerate(patterns)}
    return clauses, params


async def _purge_test_catalog() -> None:
    """Delete every mess/dish row the suite created.

    Deletion order respects the FK graph: hostel_contexts.mess_id and
    mess_menus.dish_id are ON DELETE RESTRICT, so referencing rows must be
    detached/removed before the catalog rows themselves.
    """
    mess_clause, mess_params = _like_any("name", _TEST_MESS_PATTERNS)
    dish_clause, dish_params = _like_any("name", _TEST_DISH_PATTERNS)

    async with _TestWorkerSessionLocal() as session:
        await session.execute(
            text(
                "UPDATE hostel_contexts SET mess_id = NULL WHERE mess_id IN "
                f"(SELECT id FROM messes WHERE {mess_clause})"
            ),
            mess_params,
        )
        await session.execute(
            text(
                "DELETE FROM mess_menus WHERE mess_id IN "
                f"(SELECT id FROM messes WHERE {mess_clause}) "
                "OR dish_id IN "
                f"(SELECT id FROM dishes WHERE {dish_clause})"
            ),
            {**mess_params, **dish_params},
        )
        await session.execute(
            text(f"DELETE FROM dishes WHERE {dish_clause}"), dish_params
        )
        await session.execute(
            text(f"DELETE FROM messes WHERE {mess_clause}"), mess_params
        )
        await session.commit()


@pytest.fixture(scope="session", autouse=True)
def purge_test_catalog_after_suite() -> Any:
    """Run the catalog purge once, after the whole suite finishes.

    Synchronous fixture + asyncio.run keeps it independent of pytest-asyncio
    loop scoping; NullPool means the fresh event loop gets a fresh connection.
    """
    yield
    asyncio.run(_purge_test_catalog())


# ─── auth override ────────────────────────────────────────────────────


@pytest.fixture
def fake_user_id() -> str:
    """A stable UUID used to simulate the authed user in API tests."""
    return "00000000-0000-0000-0000-000000000001"


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    """Plain DB session for direct DB assertions/cleanup.

    Uses the worker-equivalent (RLS-bypassing) connection deliberately —
    this fixture does raw setup/teardown (seeding fake users with
    arbitrary ids, deleting rows, cross-user assertions), not simulating
    a real authenticated request. It has no auth.uid() context to give
    RLS, the same way a Celery task doesn't.
    """
    async with _TestWorkerSessionLocal() as session:
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

    async def _fake_user(db: AsyncSession = Depends(get_session)) -> str:
        # Mirrors what the real get_current_user_id does: set this
        # request's RLS context on the session the route will actually
        # use. Without this, every RLS-protected query in the test suite
        # would silently see nothing (auth.uid() -> NULL), the moment
        # DATABASE_URL is ever pointed at the restricted messfit_app role.
        await db.execute(
            text("SELECT set_config('request.jwt.claims', :claims, false)"),
            {"claims": json.dumps({"sub": seed_test_user, "role": "authenticated"})},
        )
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

    async def _fake_admin(db: AsyncSession = Depends(get_session)) -> str:
        await db.execute(
            text("SELECT set_config('request.jwt.claims', :claims, false)"),
            {"claims": json.dumps({"sub": seed_admin_user, "role": "authenticated"})},
        )
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
