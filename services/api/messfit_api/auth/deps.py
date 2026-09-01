"""Supabase JWT verification.

Modern Supabase projects sign JWTs with asymmetric keys (ES256 / RS256)
distributed via a JWKS endpoint. Older projects use HS256 with a
shared secret. We support both:

1. Try asymmetric verification first using the project's JWKS
   (preferred — what new Supabase projects use)
2. Fall back to HS256 with ``SUPABASE_JWT_SECRET`` for legacy projects

The JWKS is cached for 1 hour to avoid hammering the JWKS endpoint
on every request.
"""

from __future__ import annotations

import json
import time
import uuid
from typing import Any

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_session


# ─── JWKS client (cached) ─────────────────────────────────────────────


def _jwks_url() -> str:
    return (
        f"https://{settings.supabase_project_ref}.supabase.co"
        "/auth/v1/.well-known/jwks.json"
    )


# PyJWKClient handles caching internally (default: 16 keys, 5 min TTL).
# We lazy-init so import time stays fast.
_jwks_client: PyJWKClient | None = None
_jwks_client_initialized_at: float = 0.0
_JWKS_CACHE_TTL = 3600  # 1 hour


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client, _jwks_client_initialized_at
    now = time.time()
    if _jwks_client is None or (now - _jwks_client_initialized_at) > _JWKS_CACHE_TTL:
        _jwks_client = PyJWKClient(_jwks_url(), cache_keys=True)
        _jwks_client_initialized_at = now
    return _jwks_client

# ─── verification ─────────────────────────────────────────────────────


def _verify_asymmetric(token: str) -> dict[str, Any]:
    """Verify with the project's JWKS (ES256 / RS256). Modern Supabase."""
    client = _get_jwks_client()
    signing_key = client.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256", "RS256"],
        audience="authenticated",
        options={"verify_exp": True},
        leeway=60,
    )


def _verify_hs256(token: str) -> dict[str, Any]:
    """Verify with the shared secret (HS256). Legacy Supabase."""
    return jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        audience="authenticated",
        options={"verify_exp": True},
        leeway=60,
    )


def _verify_token(token: str) -> dict[str, Any]:
    """Try asymmetric first, fall back to HS256."""
    # Inspect the unverified header to pick the right path.
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail="Malformed token") from e

    alg = header.get("alg", "").upper()

    try:
        if alg in {"ES256", "RS256"}:
            return _verify_asymmetric(token)
        if alg == "HS256":
            return _verify_hs256(token)
        raise HTTPException(status_code=401, detail=f"Unsupported alg: {alg}")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Invalid audience")
    except (jwt.PyJWTError, httpx.HTTPError) as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}") from e


# ─── FastAPI dependency ───────────────────────────────────────────────


async def get_current_user_id(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_session),
) -> str:
    """Extract and validate the user ID from the Authorization header.

    Also sets this request's Row-Level Security context on the DB session
    via set_config(..., is_local=true) — transaction-scoped, so it can
    never leak into another request that later reuses the same pooled
    connection (unlike a plain session-level SET, which would). It resets
    on the session's next commit/rollback, so this relies on the app's
    existing one-commit-per-request pattern; a handler that commits more
    than once must re-resolve identity (or re-run this) after the first.

    Every route depending on this — directly, or via get_active_user_id /
    require_admin, which both build on it — gets RLS-correct queries with
    no per-router wiring. The JSON shape/session-variable name
    ('request.jwt.claims') matches Supabase's actual auth.uid() convention
    (see migration 013), not the older flat-key one.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")

    token = authorization.removeprefix("Bearer ")
    payload = _verify_token(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing 'sub' claim")

    await db.execute(
        text("SELECT set_config('request.jwt.claims', :claims, true)"),
        {"claims": json.dumps({"sub": user_id, "role": "authenticated"})},
    )
    return user_id


async def get_active_user_id(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> str:
    """Like get_current_user_id, but rejects accounts marked for deletion.

    Composes the JWT identity check with a cheap indexed lookup of
    users.deleted_at (Phase 9, task 9.8). Use this on endpoints that must be
    closed to a user who has requested deletion within the grace window.
    """
    from ..account.repository import is_user_deleted  # local import avoids cycle

    if await is_user_deleted(db, uuid.UUID(user_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account scheduled for deletion",
        )
    return user_id


async def require_admin(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> str:
    """Dependency: raises 403 unless the authenticated user has role='admin'.

    Composes get_current_user_id (JWT check) with a DB role lookup so the
    two concerns stay separate. The DB is the source of truth for app roles —
    never rely on JWT claims for permission checks, only for identity.
    """
    from .models import UserORM  # local import avoids a top-level circular dep

    result = await db.execute(select(UserORM).where(UserORM.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user_id
