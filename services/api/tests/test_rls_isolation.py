"""Row-level security, exercised the way production runs.

The app side of the suite connects as TEST_DATABASE_URL. In CI and with
scripts/test-db.ps1 that is the restricted messfit_app role, so every policy
is enforced; these tests prove it is, and that one student can't see or change
another's data even when the API layer is bypassed.
"""

from __future__ import annotations

import json
import uuid

import pytest
from sqlalchemy import text

import messfit_api.db as db_module

pytestmark = pytest.mark.asyncio


async def _app_session_as(user_id: str | None):
    """A session on the app's connection, identified like a real request."""
    session = db_module.SessionLocal()
    if user_id is not None:
        await session.execute(
            text("SELECT set_config('request.jwt.claims', :c, false)"),
            {"c": json.dumps({"sub": user_id, "role": "authenticated"})},
        )
    return session


async def _bypasses_rls() -> bool:
    async with db_module.SessionLocal() as s:
        row = (await s.execute(text("SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user"))).scalar_one()
        return bool(row)


@pytest.fixture
async def two_users(db_session):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    for uid in (a, b):
        await db_session.execute(
            text("INSERT INTO users (id, email) VALUES (:id, :email)"),
            {"id": uid, "email": f"rls+{uid[:8]}@messfit.local"},
        )
    await db_session.execute(
        text(
            "INSERT INTO weight_logs (user_id, date, weight_kg) VALUES (:id, CURRENT_DATE, 61.5)"
        ),
        {"id": a},
    )
    await db_session.commit()
    yield a, b
    await db_session.execute(text("DELETE FROM users WHERE id IN (:a, :b)"), {"a": a, "b": b})
    await db_session.commit()


async def test_the_app_connection_is_subject_to_rls():
    if await _bypasses_rls():
        pytest.skip("TEST_DATABASE_URL uses a role that bypasses RLS; point it at messfit_app")
    assert not await _bypasses_rls()


async def test_a_user_cannot_read_another_users_rows(two_users):
    if await _bypasses_rls():
        pytest.skip("app role bypasses RLS")
    a, b = two_users
    session = await _app_session_as(b)
    try:
        seen = (await session.execute(text("SELECT count(*) FROM weight_logs WHERE user_id = :a"), {"a": a})).scalar_one()
        assert seen == 0
    finally:
        await session.close()

    session = await _app_session_as(a)
    try:
        own = (await session.execute(text("SELECT count(*) FROM weight_logs WHERE user_id = :a"), {"a": a})).scalar_one()
        assert own == 1
    finally:
        await session.close()


async def test_a_user_cannot_write_rows_for_someone_else(two_users):
    if await _bypasses_rls():
        pytest.skip("app role bypasses RLS")
    a, b = two_users
    session = await _app_session_as(b)
    try:
        with pytest.raises(Exception, match="row-level security"):
            await session.execute(
                text("INSERT INTO weight_logs (user_id, date, weight_kg) VALUES (:a, CURRENT_DATE - 1, 99)"),
                {"a": a},
            )
        await session.rollback()
        changed = (await session.execute(text("UPDATE weight_logs SET weight_kg = 99 WHERE user_id = :a"), {"a": a})).rowcount
        assert changed == 0
    finally:
        await session.rollback()
        await session.close()


async def test_nobody_can_promote_themselves_to_admin(two_users):
    if await _bypasses_rls():
        pytest.skip("app role bypasses RLS")
    a, _ = two_users
    session = await _app_session_as(a)
    try:
        with pytest.raises(Exception, match="permission denied"):
            await session.execute(text("UPDATE users SET role = 'admin' WHERE id = :a"), {"a": a})
    finally:
        await session.rollback()
        await session.close()


async def test_without_an_identity_nothing_is_visible(two_users):
    if await _bypasses_rls():
        pytest.skip("app role bypasses RLS")
    session = await _app_session_as(None)
    try:
        assert (await session.execute(text("SELECT count(*) FROM weight_logs"))).scalar_one() == 0
        assert (await session.execute(text("SELECT count(*) FROM users"))).scalar_one() == 0
    finally:
        await session.close()
