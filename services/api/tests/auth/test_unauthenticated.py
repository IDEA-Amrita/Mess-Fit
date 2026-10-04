"""Every protected endpoint answers 401 with a Bearer challenge when the
caller isn't authenticated, never 422 or a 5xx.

The routes come from the OpenAPI schema: every operation that depends on
get_current_user_id (directly, or through get_active_user_id /
require_admin) carries the HTTPBearer security requirement there. A new
endpoint is covered the moment it's protected, and the schema itself is
checked to advertise bearer auth.
"""

from __future__ import annotations

import re
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from messfit_api.main import app


def _protected_routes() -> list[tuple[str, str]]:
    out = []
    for path, ops in app.openapi()["paths"].items():
        for method, op in ops.items():
            if any("HTTPBearer" in req for req in op.get("security", [])):
                out.append((method.upper(), re.sub(r"\{[^}]+\}", str(uuid.uuid4()), path)))
    return sorted(out)


PROTECTED = _protected_routes()


def test_the_sweep_finds_the_api():
    # Guards the guard: if discovery broke, every parametrized case would vanish.
    assert len(PROTECTED) >= 40


@pytest.fixture
async def anon():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.parametrize(("method", "path"), PROTECTED)
@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Basic dXNlcjpwYXNz"},
        {"Authorization": "Bearer "},
        {"Authorization": "Bearer not-a-jwt"},
    ],
    ids=["no-header", "basic-scheme", "empty-bearer", "malformed-jwt"],
)
async def test_unauthenticated_requests_get_401(anon, method, path, headers):
    r = await anon.request(method, path, headers=headers, json={})
    assert r.status_code == 401, f"{method} {path} -> {r.status_code}: {r.text[:200]}"
    assert r.headers.get("www-authenticate") == "Bearer"
