"""Data access for the account-deletion flow (Phase 9, task 9.8).

Soft-delete stamps users.deleted_at; the daily sweep hard-deletes rows past the
grace period. All of a user's data is removed by FK ON DELETE CASCADE
(profiles, hostel_contexts, *_logs, chatbot_*, dish_exclusions, ocr_jobs, …),
so a single DELETE FROM users is enough.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def is_user_deleted(db: AsyncSession, user_id: uuid.UUID) -> bool:
    """True if the user row exists and is marked deleted."""
    deleted_at = await db.scalar(
        text("SELECT deleted_at FROM users WHERE id = :id"), {"id": str(user_id)}
    )
    return deleted_at is not None


async def soft_delete_user(db: AsyncSession, user_id: uuid.UUID) -> datetime:
    """Mark the account deleted (idempotent: keeps the first timestamp).

    Returns the effective deleted_at.
    """
    deleted_at = await db.scalar(
        text(
            "UPDATE users SET deleted_at = COALESCE(deleted_at, NOW()) "
            "WHERE id = :id RETURNING deleted_at"
        ),
        {"id": str(user_id)},
    )
    await db.commit()
    assert deleted_at is not None
    return deleted_at


async def list_pending_hard_delete(db: AsyncSession, before: datetime) -> list[uuid.UUID]:
    """User ids whose deletion grace period has elapsed."""
    rows = (
        (
            await db.execute(
                text("SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at < :before"),
                {"before": before},
            )
        )
        .scalars()
        .all()
    )
    return [r if isinstance(r, uuid.UUID) else uuid.UUID(str(r)) for r in rows]


async def hard_delete_user(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Permanently remove the user; FK CASCADE removes all owned rows."""
    await db.execute(text("DELETE FROM users WHERE id = :id"), {"id": str(user_id)})
    await db.commit()
