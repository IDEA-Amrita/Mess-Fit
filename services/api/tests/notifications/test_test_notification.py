"""POST /api/v1/notifications/test — self-addressed sample push."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

_TEST_UID = "00000000-0000-0000-0000-000000000001"


async def test_test_notification_reports_delivered_count(client):
    send = AsyncMock(return_value=2)
    with patch("messfit_api.notifications.router.send_push_notification", send):
        r = await client.post("/api/v1/notifications/test")

    assert r.status_code == 200
    assert r.json() == {"delivered": 2}

    _db, uid, payload = send.await_args.args
    assert str(uid) == _TEST_UID  # only ever addressed to the caller
    assert json.loads(payload)["url"] == "/dashboard/settings"


async def test_test_notification_with_no_subscriptions_delivers_zero(client):
    send = AsyncMock(return_value=0)
    with patch("messfit_api.notifications.router.send_push_notification", send):
        r = await client.post("/api/v1/notifications/test")

    assert r.status_code == 200
    assert r.json() == {"delivered": 0}
