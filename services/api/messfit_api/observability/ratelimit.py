"""Request rate limiting (Phase 9, task 9.4).

A single shared `Limiter` (slowapi) keyed by the caller's identity — a
hashed Authorization header when present (so a logged-in user is limited
per token without exposing the raw JWT in storage), falling back to the
client IP for anonymous calls.

Storage:
- **Production** sets `RATE_LIMIT_STORAGE_URI` to the Redis URL so limits are
  shared across worker processes.
- **Default / dev / tests** use in-memory storage (`memory://`) so nothing
  depends on a running Redis and the limits are deterministic in-process.

`RATE_LIMIT_ENABLED=false` disables limiting entirely (handy for local load
experiments).

Signup/login are NOT rate-limited here: MessFit has no backend auth endpoint —
Supabase Auth owns signup/login and applies its own limits.
"""

from __future__ import annotations

import hashlib

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from ..config import settings


def _rate_key(request: Request) -> str:
    auth = request.headers.get("authorization")
    if auth:
        return f"auth:{hashlib.sha256(auth.encode()).hexdigest()[:16]}"
    return get_remote_address(request)


limiter = Limiter(
    key_func=_rate_key,
    storage_uri=settings.rate_limit_storage_uri or "memory://",
    enabled=settings.rate_limit_enabled,
    # Header injection requires a `response: Response` param on every limited
    # route; our routes return models/StreamingResponse, so keep it off. Limits
    # still enforce and overflow still returns 429.
    headers_enabled=False,
)
