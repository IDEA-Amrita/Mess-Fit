"""Account deletion: soft-delete endpoint, access rejection, and the hard-delete
sweep (Phase 9, task 9.8)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from messfit_api.account import repository
from messfit_api.account.tasks import sweep_pending_deletions

_TEST_UID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture(autouse=True)
def _no_supabase_call():
    # The endpoint fires a best-effort Supabase admin call; stub it in tests.
    with patch(
        "messfit_api.account.supabase_admin.mark_pending_deletion",
        return_value=False,
    ):
        yield


async def test_delete_account_sets_deleted_at(client, db_session: AsyncSession):
    r = await client.post("/api/v1/account/delete", json={"confirm": "DELETE"})
    assert r.status_code == 200
    body = r.json()
    assert body["deleted_at"] is not None
    assert body["hard_delete_after"] > body["deleted_at"]

    deleted_at = await db_session.scalar(
        text("SELECT deleted_at FROM users WHERE id = :id"), {"id": _TEST_UID}
    )
    assert deleted_at is not None


async def test_delete_account_rejects_bad_confirmation(client):
    r = await client.post("/api/v1/account/delete", json={"confirm": "yes"})
    assert r.status_code == 422


async def test_deleted_user_blocked_on_protected_route(client, db_session: AsyncSession):
    # Soft-delete, then a protected route (/me uses get_active_user_id) → 403.
    await repository.soft_delete_user(db_session, uuid.UUID(_TEST_UID))
    r = await client.get("/api/v1/me")
    assert r.status_code == 403


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/v1/profile/me"),
        ("GET", "/api/v1/logs/today"),
        ("GET", "/api/v1/workouts/today"),
        ("GET", "/mess/menu/exclusions"),
    ],
)
async def test_deleted_user_blocked_across_all_routers(
    client, db_session: AsyncSession, method: str, path: str
):
    # Regression guard: every router's default dependency must be
    # get_active_user_id, not the raw get_current_user_id — a soft-deleted
    # user must be rejected everywhere, not just on /me.
    await repository.soft_delete_user(db_session, uuid.UUID(_TEST_UID))
    r = await client.request(method, path)
    assert r.status_code == 403


async def test_hard_delete_pending_removes_expired(db_session: AsyncSession):
    # A user soft-deleted 31 days ago should be erased by the sweep.
    uid = uuid.uuid4()
    await db_session.execute(
        text("INSERT INTO users (id, email, deleted_at) VALUES (:id, :email, :deleted_at)"),
        {
            "id": str(uid),
            "email": f"gone+{uid.hex[:8]}@messfit.local",
            "deleted_at": datetime.now(timezone.utc) - timedelta(days=31),
        },
    )
    await db_session.commit()

    await sweep_pending_deletions(db_session)

    exists = await db_session.scalar(
        text("SELECT count(*) FROM users WHERE id = :id"), {"id": str(uid)}
    )
    assert exists == 0


async def test_hard_delete_pending_keeps_within_grace(db_session: AsyncSession):
    # Soft-deleted 5 days ago → still within the 30-day grace, must remain.
    uid = uuid.uuid4()
    await db_session.execute(
        text("INSERT INTO users (id, email, deleted_at) VALUES (:id, :email, :deleted_at)"),
        {
            "id": str(uid),
            "email": f"recent+{uid.hex[:8]}@messfit.local",
            "deleted_at": datetime.now(timezone.utc) - timedelta(days=5),
        },
    )
    await db_session.commit()

    await sweep_pending_deletions(db_session)

    exists = await db_session.scalar(
        text("SELECT count(*) FROM users WHERE id = :id"), {"id": str(uid)}
    )
    assert exists == 1

    # cleanup
    await db_session.execute(text("DELETE FROM users WHERE id = :id"), {"id": str(uid)})
    await db_session.commit()
