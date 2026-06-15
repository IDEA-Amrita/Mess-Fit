"""Best-effort Supabase admin notification for account deletion (Phase 9, 9.8).

When a user requests deletion we flag their Supabase auth record via the admin
REST API (service-role key). This records the request on the auth side and is
the hook a Supabase email template / DB webhook uses to send the confirmation
email — Supabase has no generic "send transactional email" REST endpoint, so the
literal email depends on the project's SMTP/template config.

This is **best-effort**: any failure is logged and swallowed so it can never
block the user's deletion request.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


async def mark_pending_deletion(user_id: str) -> bool:
    """Flag the Supabase auth user as pending deletion. Returns True on success.

    Never raises — returns False and logs on any problem.
    """
    if not settings.supabase_service_role_key or not settings.supabase_url:
        logger.info("Supabase admin not configured; skipping deletion notification")
        return False

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{user_id}"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    body = {
        "user_metadata": {
            "pending_deletion": True,
            "deletion_requested_at": datetime.now(timezone.utc).isoformat(),
        }
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.put(url, headers=headers, json=body)
            resp.raise_for_status()
        return True
    except Exception as exc:  # noqa: BLE001 — best-effort, must not block deletion
        logger.warning("Supabase deletion notification failed: %s", exc)
        return False
