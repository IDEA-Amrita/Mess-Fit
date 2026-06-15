"""Account-deletion endpoint (Phase 9, task 9.8).

POST /api/v1/account/delete  — soft-delete the authenticated account.

Soft-delete stamps users.deleted_at; a daily Celery beat job (account/tasks.py)
hard-deletes after a 30-day grace period. We notify Supabase (best-effort) so the
auth record is flagged and the confirmation email can fire.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import get_current_user_id
from ..db import get_session
from ..observability.ratelimit import limiter
from . import repository, supabase_admin
from .schemas import GRACE_PERIOD_DAYS, DeleteAccountIn, DeleteAccountOut

router = APIRouter(prefix="/api/v1/account", tags=["account"])


@router.post("/delete", response_model=DeleteAccountOut)
@limiter.limit("5/hour")
async def delete_account(
    request: Request,
    payload: DeleteAccountIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> DeleteAccountOut:
    """Soft-delete the caller's account (idempotent). Confirmation is validated
    by the schema; the valid JWT proves identity."""
    uid = uuid.UUID(user_id)
    deleted_at = await repository.soft_delete_user(db, uid)
    await supabase_admin.mark_pending_deletion(user_id)
    return DeleteAccountOut(
        deleted_at=deleted_at,
        hard_delete_after=deleted_at + timedelta(days=GRACE_PERIOD_DAYS),
    )
