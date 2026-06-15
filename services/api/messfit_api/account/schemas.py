"""Schemas for the account-deletion flow (Phase 9, task 9.8)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, field_validator

# The grace period before a soft-deleted account is permanently erased.
GRACE_PERIOD_DAYS = 30

_CONFIRM_PHRASE = "DELETE"


class DeleteAccountIn(BaseModel):
    """Body for POST /account/delete. We require an explicit typed confirmation
    rather than a password (Supabase owns passwords) plus the valid JWT."""

    confirm: str

    @field_validator("confirm")
    @classmethod
    def _must_match(cls, v: str) -> str:
        if v.strip() != _CONFIRM_PHRASE:
            raise ValueError(f"Type {_CONFIRM_PHRASE!r} to confirm account deletion")
        return v


class DeleteAccountOut(BaseModel):
    deleted_at: datetime
    hard_delete_after: datetime
