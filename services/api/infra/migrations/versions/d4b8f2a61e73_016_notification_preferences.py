"""016 notification_preferences — per-user opt-out for notification kinds

One row per user, created lazily on first change; no row means the defaults
(everything on). Own-row-only RLS so one student can never read or change
another's preferences; the Celery worker (BYPASSRLS) reads them when deciding
who to notify. Cascades away with the user on account deletion.

Revision ID: d4b8f2a61e73
Revises: c7a2e9d41b60
Create Date: 2026-09-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4b8f2a61e73"
down_revision: Union[str, Sequence[str], None] = "c7a2e9d41b60"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notification_preferences",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("weekly_checkin", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.execute("ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY notification_preferences_own ON notification_preferences "
        "FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())"
    )
    # Table grants for messfit_app / messfit_worker come from the default
    # privileges set in migration 013.


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS notification_preferences_own ON notification_preferences")
    op.drop_table("notification_preferences")
