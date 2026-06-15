"""Sentry init is a no-op without a DSN, and scrub_pii strips PII/health data
before any event leaves the process (Phase 9, task 9.3)."""

from __future__ import annotations

from messfit_api.observability import sentry as sentry_mod


def test_init_sentry_noop_without_dsn():
    class _S:
        sentry_dsn = ""
        environment = "test"

    assert sentry_mod.init_sentry(_S()) is False  # type: ignore[arg-type]


def test_scrub_pii_strips_request_body_and_headers():
    event = {
        "request": {
            "data": {"current_weight_kg": 72.5, "conditions": ["pcos"]},
            "query_string": "email=a@b.com",
            "cookies": {"sb-access-token": "secret"},
            "headers": {"Authorization": "Bearer abc", "User-Agent": "x"},
        },
        "user": {"id": "uid-1", "email": "a@b.com", "ip_address": "1.2.3.4"},
    }
    out = sentry_mod.scrub_pii(event, {})
    assert out is not None
    req = out["request"]
    assert "data" not in req
    assert "query_string" not in req
    assert "cookies" not in req
    assert req["headers"]["Authorization"] == "[redacted]"
    assert req["headers"]["User-Agent"] == "x"
    # Only an opaque id survives — no email / ip.
    assert out["user"] == {"id": "uid-1"}


def test_scrub_pii_redacts_emails_in_messages_and_exceptions():
    event = {
        "message": "failed for user jane.doe@example.com",
        "exception": {"values": [{"value": "duplicate email bob@test.in"}]},
    }
    out = sentry_mod.scrub_pii(event, {})
    assert out is not None
    assert "@example.com" not in out["message"]
    assert "[redacted-email]" in out["message"]
    assert "@test.in" not in out["exception"]["values"][0]["value"]
