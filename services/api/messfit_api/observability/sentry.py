"""Sentry error reporting with PII scrubbing (Phase 9, task 9.3).

`init_sentry(settings)` initialises Sentry **only when `settings.sentry_dsn` is
set** — no DSN, no init, so dev and tests never ship events.

MessFit handles health data (weight, conditions, dietary info). The
`scrub_pii` before-send hook strips anything that could carry personal or health
information out of every event before it leaves the process: request bodies and
query strings, cookies, the Authorization header, and any email-looking strings
in exception/message text. One leaked health record is not acceptable, so the
hook errs on the side of dropping data.
"""

from __future__ import annotations

import re
from typing import Any

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from sentry_sdk.types import Event, Hint

from ..config import Settings

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_SENSITIVE_HEADERS = {"authorization", "cookie", "set-cookie", "x-api-key"}


def _redact_emails(value: Any) -> Any:
    if isinstance(value, str):
        return _EMAIL_RE.sub("[redacted-email]", value)
    return value


def scrub_pii(event: Event, hint: Hint) -> Event | None:
    """before_send: remove PII / health data from an event in place.

    Returns the scrubbed event (never None — we still want the error, just
    without the sensitive payload).
    """
    request = event.get("request")
    if isinstance(request, dict):
        # Bodies and query strings can carry weights, conditions, free-text notes.
        request.pop("data", None)
        request.pop("query_string", None)
        request.pop("cookies", None)
        headers = request.get("headers")
        if isinstance(headers, dict):
            for key in list(headers):
                if key.lower() in _SENSITIVE_HEADERS:
                    headers[key] = "[redacted]"

    # Drop user identifiers beyond an opaque id (never email / username / ip).
    user = event.get("user")
    if isinstance(user, dict):
        event["user"] = {"id": user.get("id")} if user.get("id") else {}

    # Scrub any email addresses that leaked into messages / exception values.
    if isinstance(event.get("message"), str):
        event["message"] = _redact_emails(event["message"])
    for exc in (event.get("exception") or {}).get("values", []):
        if isinstance(exc, dict) and isinstance(exc.get("value"), str):
            exc["value"] = _redact_emails(exc["value"])

    return event


def init_sentry(settings: Settings) -> bool:
    """Initialise Sentry. Returns True if a DSN was configured and init ran."""
    dsn = settings.sentry_dsn.strip()
    if not dsn:
        return False
    sentry_sdk.init(
        dsn=dsn,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        environment=settings.environment,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        send_default_pii=False,
        before_send=scrub_pii,
    )
    return True
