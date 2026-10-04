"""Product analytics: what may be stored, and who may write/read it.

The validation tests are pure. The endpoint tests replace the DB session and
auth dependencies, so they exercise routing, validation and the "always
attributed to the caller" rule without needing rows in a database.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import pytest
from pydantic import ValidationError

from messfit_api.analytics.schemas import ALLOWED_EVENTS, EventIn
from messfit_api.auth.deps import get_active_user_id, require_admin
from messfit_api.db import get_session
from messfit_api.main import app

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731
CALLER = "00000000-0000-0000-0000-0000000000aa"


def _event(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "name": "meal_logged",
        "props": {"meal": "lunch"},
        "occurred_at": NOW().isoformat(),
    }
    base.update(over)
    return base


# ─── validation ─────────────────────────────────────────────────────────


def test_accepts_a_normal_event():
    e = EventIn(**_event(props={"meal": "lunch", "via": "plate", "count": 3, "ok": True}))
    assert e.props["count"] == 3


@pytest.mark.parametrize("name", ["page_view", "MEAL_LOGGED", "", "drop table users"])
def test_rejects_event_names_outside_the_allowlist(name: str):
    with pytest.raises(ValidationError):
        EventIn(**_event(name=name))


@pytest.mark.parametrize(
    "value",
    [
        "I ate two dosas and felt sick",  # free text
        "someone@example.com",  # an email (has an @)
        "Lunch",  # uppercase
        "x" * 65,  # too long
        "",
    ],
)
def test_rejects_free_text_prop_values(value: str):
    with pytest.raises(ValidationError):
        EventIn(**_event(props={"note": value}))


def test_rejects_bad_prop_keys_and_too_many_props():
    with pytest.raises(ValidationError):
        EventIn(**_event(props={"Bad Key": "x"}))
    with pytest.raises(ValidationError):
        EventIn(**_event(props={f"k{i}": i for i in range(9)}))


def test_rejects_nested_props():
    with pytest.raises(ValidationError):
        EventIn(**_event(props={"meal": {"nested": "x"}}))


def test_timestamps_must_be_aware_and_recent():
    with pytest.raises(ValidationError):
        EventIn(**_event(occurred_at="2026-09-25T10:00:00"))  # naive
    with pytest.raises(ValidationError):
        EventIn(**_event(occurred_at=(NOW() - timedelta(days=30)).isoformat()))  # backdated
    with pytest.raises(ValidationError):
        EventIn(**_event(occurred_at=(NOW() + timedelta(hours=2)).isoformat()))  # future


def test_every_allowed_event_name_is_a_slug():
    for name in ALLOWED_EVENTS:
        assert name == name.lower() and " " not in name


# ─── endpoints ──────────────────────────────────────────────────────────


class _FakeSession:
    def __init__(self) -> None:
        self.inserted: list[dict[str, Any]] = []
        self.commits = 0

    async def execute(self, _stmt: Any, params: Any = None) -> None:
        if isinstance(params, list):
            self.inserted.extend(params)

    async def commit(self) -> None:
        self.commits += 1


@pytest.fixture
def api():
    session = _FakeSession()

    async def _session():
        yield session

    app.dependency_overrides[get_active_user_id] = lambda: CALLER
    app.dependency_overrides[get_session] = _session
    transport = httpx.ASGITransport(app=app)
    client = httpx.AsyncClient(transport=transport, base_url="http://t")
    yield client, session
    app.dependency_overrides.clear()


async def test_ingest_attributes_every_event_to_the_caller(api):
    client, session = api
    body = {"events": [_event(), _event(name="plate_viewed", props={"source": "today"})]}
    r = await client.post("/api/v1/analytics/events", json=body)

    assert r.status_code == 204
    assert session.commits == 1
    assert [row["name"] for row in session.inserted] == ["meal_logged", "plate_viewed"]
    assert {str(row["user_id"]) for row in session.inserted} == {CALLER}


async def test_body_cannot_name_another_user(api):
    client, session = api
    other = str(uuid.uuid4())
    r = await client.post("/api/v1/analytics/events", json={"events": [_event(user_id=other)]})
    # Unknown fields are ignored, and the row is still the caller's.
    assert r.status_code == 204
    assert {str(row["user_id"]) for row in session.inserted} == {CALLER}


async def test_ingest_rejects_bad_batches(api):
    client, session = api
    assert (await client.post("/api/v1/analytics/events", json={"events": []})).status_code == 422
    too_many = {"events": [_event() for _ in range(21)]}
    assert (await client.post("/api/v1/analytics/events", json=too_many)).status_code == 422
    bad = {"events": [_event(props={"note": "free text with spaces"})]}
    assert (await client.post("/api/v1/analytics/events", json=bad)).status_code == 422
    assert session.inserted == []


async def test_summary_is_admin_only(api):
    client, _ = api
    # No admin override installed: the real dependency chain (JWT check, then
    # role lookup) runs, and a bad token never gets as far as the query.
    r = await client.get(
        "/api/v1/analytics/summary", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert r.status_code in (401, 403)


async def test_summary_shape_for_an_admin():
    class _Rows:
        def __init__(self, rows: list[Any]) -> None:
            self._rows = rows

        def all(self) -> list[Any]:
            return self._rows

        def one(self) -> Any:
            return self._rows[0]

    class _Row:
        def __init__(self, **kw: Any) -> None:
            self.__dict__.update(kw)

    class _Session:
        def __init__(self) -> None:
            self.calls = 0

        async def execute(self, *_a: Any, **_k: Any) -> _Rows:
            self.calls += 1
            if self.calls == 1:
                return _Rows([_Row(day="2026-09-24", users=3)])
            if self.calls == 2:
                return _Rows([_Row(name="meal_logged", events=9, users=3)])
            return _Rows([_Row(events=9, users=3)])

    async def _session():
        yield _Session()

    app.dependency_overrides[require_admin] = lambda: CALLER
    app.dependency_overrides[get_session] = _session
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://t"
        ) as c:
            r = await c.get("/api/v1/analytics/summary?days=7")
    finally:
        app.dependency_overrides.clear()

    assert r.status_code == 200
    assert r.json() == {
        "window_days": 7,
        "total_events": 9,
        "active_users_window": 3,
        "dau": [{"day": "2026-09-24", "users": 3}],
        "by_event": [{"name": "meal_logged", "events": 9, "users": 3}],
    }
