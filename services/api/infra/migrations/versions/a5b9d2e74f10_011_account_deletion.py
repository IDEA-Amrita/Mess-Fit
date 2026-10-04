"""011 account deletion

Adds users.deleted_at for the DPDP-compliant soft-delete → 30-day hard-delete
flow (Phase 9, task 9.8). When a user requests deletion we stamp deleted_at;
a daily Celery beat job hard-deletes rows older than the grace period (FK
CASCADE removes all owned data — profiles, logs, conversations, etc.).

A partial index on deleted_at keeps the daily sweep cheap (only marked rows are
indexed).

Revision ID: a5b9d2e74f10
Revises: f4a8c1d63e29
Create Date: 2026-06-16 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "a5b9d2e74f10"
down_revision: Union[str, Sequence[str], None] = "f4a8c1d63e29"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

        -- Only marked rows are indexed → small index, fast daily sweep.
        CREATE INDEX idx_users_deleted_at
          ON users (deleted_at)
          WHERE deleted_at IS NOT NULL;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS idx_users_deleted_at;
        ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
        """
    )
