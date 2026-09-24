"""Notification preferences + who gets the weekly check-in.

DB-free: a fake session records the statements, and the recipient query is
compiled to Postgres SQL and inspected. (Row-level behaviour is enforced by
RLS, checked by the migration's SQL, not re-simulated here.)
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from sqlalchemy.dialects import postgresql

from messfit_api.auth.deps import get_active_user_id
from messfit_api.db import get_session
from messfit_api.main import app
from messfit_api.notifications import repository, tasks

CALLER = "00000000-0000-0000-0000-0000000000bb"


class _Result:
    def __init__(self, value: Any):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalars(self):
        return SimpleNamespace(all=lambda: self.value)


class _FakeSession:
    def __init__(self, stored: bool | None = None):
        self.stored = stored
        self.statements: list[Any] = []
        self.commits = 0

    async def execute(self, stmt: Any):
        self.statements.append(stmt)
        return _Result(self.stored)

    async def commit(self):
        self.commits += 1


@pytest.fixture
def api():
    holder = {"session": _FakeSession()}

    async def _session():
        yield holder["session"]

    app.dependency_overrides[get_active_user_id] = lambda: CALLER
    app.dependency_overrides[get_session] = _session
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")
    yield client, holder
    app.dependency_overrides.clear()


async def test_no_row_means_the_default_of_on(api):
    client, holder = api
    holder["session"] = _FakeSession(stored=None)
    r = await client.get("/api/v1/notifications/preferences")
    assert r.status_code == 200
    assert r.json() == {"weekly_checkin": True}


async def test_a_stored_opt_out_is_returned(api):
    client, holder = api
    holder["session"] = _FakeSession(stored=False)
    assert (await client.get("/api/v1/notifications/preferences")).json() == {"weekly_checkin": False}


async def test_put_upserts_only_the_callers_row(api):
    client, holder = api
    r = await client.put("/api/v1/notifications/preferences", json={"weekly_checkin": False})
    assert r.status_code == 200
    assert r.json() == {"weekly_checkin": False}

    session = holder["session"]
    assert session.commits == 1
    stmt = session.statements[0].compile(dialect=postgresql.dialect())
    assert "ON CONFLICT (user_id) DO UPDATE" in str(stmt)
    assert uuid.UUID(CALLER) in stmt.params.values()  # the caller, and nobody named in the body


async def test_put_ignores_a_user_id_in_the_body(api):
    client, holder = api
    other = str(uuid.uuid4())
    r = await client.put("/api/v1/notifications/preferences", json={"weekly_checkin": True, "user_id": other})
    assert r.status_code == 200
    params = holder["session"].statements[0].compile(dialect=postgresql.dialect()).params.values()
    assert uuid.UUID(other) not in params


@pytest.mark.parametrize("body", [{}, {"weekly_checkin": "maybe"}, {"weekly_checkin": None}])
async def test_put_rejects_bad_bodies(api, body):
    client, holder = api
    assert (await client.put("/api/v1/notifications/preferences", json=body)).status_code == 422
    assert holder["session"].statements == []


async def test_recipient_query_excludes_opted_out_deleted_and_device_less_users():
    session = _FakeSession()
    session.stored = []
    await repository.list_weekly_checkin_recipients(session)
    sql = str(session.statements[0].compile(dialect=postgresql.dialect()))
    assert "FROM push_subscriptions JOIN users" in sql  # has a device
    assert "LEFT OUTER JOIN notification_preferences" in sql  # opt-out consulted
    assert "users.deleted_at IS NULL" in sql  # pending deletion excluded
    assert "coalesce(notification_preferences.weekly_checkin" in sql  # no row = on
    assert "DISTINCT" in sql  # several devices, one notification run per user


async def test_weekly_task_notifies_only_the_recipients_it_is_given():
    a, b = uuid.uuid4(), uuid.uuid4()
    send = AsyncMock(return_value=1)

    class _Ctx:
        async def __aenter__(self):
            return object()

        async def __aexit__(self, *exc):
            return False

    with (
        patch.object(tasks, "WorkerSessionLocal", lambda: _Ctx()),
        patch.object(tasks.repository, "list_weekly_checkin_recipients", AsyncMock(return_value=[a, b])),
        patch.object(tasks, "send_push_notification", send),
    ):
        await tasks._notify_weekly_checkin()

    assert [c.args[1] for c in send.await_args_list] == [a, b]


async def test_one_failing_device_does_not_stop_the_rest():
    a, b = uuid.uuid4(), uuid.uuid4()
    send = AsyncMock(side_effect=[RuntimeError("push service down"), 1])

    class _Ctx:
        async def __aenter__(self):
            return object()

        async def __aexit__(self, *exc):
            return False

    with (
        patch.object(tasks, "WorkerSessionLocal", lambda: _Ctx()),
        patch.object(tasks.repository, "list_weekly_checkin_recipients", AsyncMock(return_value=[a, b])),
        patch.object(tasks, "send_push_notification", send),
    ):
        await tasks._notify_weekly_checkin()

    assert send.await_count == 2
