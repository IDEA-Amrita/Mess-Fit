"""Rate limiting returns 429 once a route's per-window budget is exceeded
(Phase 9, task 9.4).

The limiter is disabled for the rest of the suite (see conftest); this test
flips it on for its own window and uses a dedicated key so its counts don't
collide with other tests.
"""

from __future__ import annotations

import pytest

from messfit_api.observability.ratelimit import limiter

# conversation create is limited to 10/minute
_LIMIT = 10
_KEY = {"Authorization": "Bearer ratelimit-test-key"}


@pytest.fixture
def rate_limiting_on():
    limiter.enabled = True
    try:
        yield
    finally:
        limiter.enabled = False


async def test_conversation_create_returns_429_over_limit(client, rate_limiting_on):
    statuses = []
    for _ in range(_LIMIT + 1):
        r = await client.post("/api/v1/chat/conversations", headers=_KEY)
        statuses.append(r.status_code)

    assert statuses[:_LIMIT] == [201] * _LIMIT
    assert statuses[_LIMIT] == 429


async def test_no_limit_when_disabled(client):
    # With the limiter disabled (suite default), the same burst all succeeds.
    assert limiter.enabled is False
    statuses = [
        (await client.post("/api/v1/chat/conversations", headers=_KEY)).status_code
        for _ in range(_LIMIT + 2)
    ]
    assert all(s == 201 for s in statuses)
