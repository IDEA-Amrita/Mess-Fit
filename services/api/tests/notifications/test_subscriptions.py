"""Push subscriptions: only real browser push-service endpoints are stored or
contacted (the server POSTs to them — anything else would be SSRF), rows are
claimed through claim_push_subscription(), and migration 018 closes the
Supabase Data API. DB-free: fake session, captured migration SQL.
"""

from __future__ import annotations

import importlib.util
import uuid
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from pydantic import ValidationError

from messfit_api.auth.deps import get_active_user_id
from messfit_api.db import get_session
from messfit_api.main import app
from messfit_api.notifications import service
from messfit_api.notifications.schemas import PushSubscriptionIn, is_push_service_url

CALLER = "00000000-0000-0000-0000-0000000000dd"
KEYS = {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", "auth": "tBHItJI5svbpez7KI4CCXg"}


# ─── which endpoints are acceptable ─────────────────────────────────────


@pytest.mark.parametrize(
    "url",
    [
        "https://fcm.googleapis.com/fcm/send/abc:APA91b",
        "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
        "https://web.push.apple.com/QGuQyavXutnMH",
        "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
        "https://android.googleapis.com/gcm/send/abc",
    ],
)
def test_real_push_services_are_accepted(url):
    assert is_push_service_url(url)
    assert PushSubscriptionIn(endpoint=url, keys=KEYS).endpoint == url


@pytest.mark.parametrize(
    "url",
    [
        "http://fcm.googleapis.com/fcm/send/abc",  # not TLS
        "https://169.254.169.254/latest/meta-data/",  # cloud metadata
        "https://localhost/admin",
        "https://10.0.0.5/internal",
        "https://fcm.googleapis.com.evil.example/x",  # lookalike suffix
        "https://evilfcm.googleapis.com.example/x",
        "https://fcm.googleapis.com@evil.example/x",  # userinfo trick
        "https://fcm.googleapis.com:8443/x",  # unexpected port
        "https://notfcm.googleapis.co/x",
        "file:///etc/passwd",
        "not a url",
        "",
    ],
)
def test_anything_else_is_rejected(url):
    assert not is_push_service_url(url)
    with pytest.raises(ValidationError):
        PushSubscriptionIn(endpoint=url, keys=KEYS)


@pytest.mark.parametrize(
    "keys",
    [{}, {"p256dh": KEYS["p256dh"]}, {"p256dh": "short", "auth": KEYS["auth"]}, {"p256dh": KEYS["p256dh"], "auth": "has spaces in it"}],
)
def test_encryption_keys_are_required_and_well_formed(keys):
    with pytest.raises(ValidationError):
        PushSubscriptionIn(endpoint="https://fcm.googleapis.com/fcm/send/abc", keys=keys)


# ─── endpoints ──────────────────────────────────────────────────────────


class _FakeSession:
    def __init__(self) -> None:
        self.statements: list[tuple[str, Any]] = []
        self.commits = 0

    async def execute(self, stmt: Any, params: Any = None):
        self.statements.append((str(stmt), params))
        return SimpleNamespace()

    async def commit(self) -> None:
        self.commits += 1


@pytest.fixture
def api():
    session = _FakeSession()

    async def _session():
        yield session

    app.dependency_overrides[get_active_user_id] = lambda: CALLER
    app.dependency_overrides[get_session] = _session
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")
    yield client, session
    app.dependency_overrides.clear()


async def test_subscribe_claims_the_endpoint_for_the_signed_in_user(api):
    client, session = api
    endpoint = "https://fcm.googleapis.com/fcm/send/abc"
    r = await client.post("/api/v1/notifications/subscribe", json={"endpoint": endpoint, "keys": KEYS})
    assert r.status_code == 201
    assert r.json() == {"endpoint": endpoint}
    sql, params = session.statements[0]
    assert "claim_push_subscription" in sql
    assert params == {"endpoint": endpoint, "p256dh": KEYS["p256dh"], "auth": KEYS["auth"]}
    assert session.commits == 1


async def test_subscribe_refuses_a_non_push_endpoint_without_touching_the_db(api):
    client, session = api
    r = await client.post(
        "/api/v1/notifications/subscribe",
        json={"endpoint": "https://169.254.169.254/latest/meta-data/", "keys": KEYS},
    )
    assert r.status_code == 422
    assert session.statements == []


async def test_unsubscribe_needs_only_the_endpoint(api):
    client, session = api
    r = await client.request(
        "DELETE", "/api/v1/notifications/unsubscribe", json={"endpoint": "https://fcm.googleapis.com/fcm/send/abc"}
    )
    assert r.status_code == 204
    assert "DELETE FROM push_subscriptions" in session.statements[0][0]


# ─── sending ────────────────────────────────────────────────────────────


async def test_a_stored_non_push_endpoint_is_dropped_never_contacted():
    uid = uuid.uuid4()
    bad = SimpleNamespace(endpoint="https://10.0.0.5/internal", p256dh="p", auth="a")
    good = SimpleNamespace(endpoint="https://fcm.googleapis.com/fcm/send/ok", p256dh="p", auth="a")
    contacted: list[str] = []
    removed: list[str] = []

    async def fake_remove(_db, _uid, endpoint):
        removed.append(endpoint)

    with (
        patch.object(service.settings, "vapid_private_key", "k"),
        patch.object(service.repository, "get_user_subscriptions", AsyncMock(return_value=[bad, good])),
        patch.object(service.repository, "remove_subscription", fake_remove),
        patch.object(service, "webpush", lambda **kw: contacted.append(kw["subscription_info"]["endpoint"])),
    ):
        delivered = await service.send_push_notification(object(), uid, "{}")  # type: ignore[arg-type]

    assert delivered == 1
    assert removed == [bad.endpoint]
    assert contacted == [good.endpoint]


# ─── migration 018 ──────────────────────────────────────────────────────


def _migration_sql() -> str:
    path = next(Path(__file__).parents[2].glob("infra/migrations/versions/f6d0b4c83e29_018*.py"))
    spec = importlib.util.spec_from_file_location("m018", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    executed: list[str] = []
    with patch.object(mod.op, "execute", lambda sql: executed.append(str(sql))):
        mod.upgrade()
    return "\n".join(executed)


def test_migration_closes_the_data_api_for_both_supabase_roles():
    sql = _migration_sql()
    for role in ("anon", "authenticated"):
        assert f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {role}" in sql
        assert f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM {role}" in sql
        assert f"rolname = '{role}'" in sql  # guarded: local Postgres has no such role


def test_migration_puts_push_subscriptions_under_own_row_rls():
    sql = _migration_sql()
    assert "ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY" in sql
    assert "USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())" in sql


def test_claim_function_is_locked_down():
    sql = _migration_sql()
    assert "SECURITY DEFINER" in sql
    assert "SET search_path = public, pg_temp" in sql  # no search_path hijack
    assert "VALUES (caller," in sql  # always the authenticated caller, never a parameter
    assert "REVOKE ALL ON FUNCTION public.claim_push_subscription(text, text, text) FROM PUBLIC" in sql
    assert "GRANT EXECUTE ON FUNCTION public.claim_push_subscription(text, text, text) TO messfit_app" in sql
