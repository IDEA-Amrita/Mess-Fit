"""015 analytics_events — first-party product analytics

A deliberately small, privacy-first event log for pilot learning (funnels,
DAU/WAU, feature usage). Design constraints, all enforced somewhere:

- No third party ever sees the data; it lives in our own database.
- Rows carry a user_id and an allow-listed event name with a few short
  slug-valued props — never free text, IPs, user agents, or the content of
  what a user logged (validated in the API layer, see analytics/schemas.py).
- ON DELETE CASCADE from users: the account-deletion hard sweep erases a
  user's events with them.
- RLS: a user may only INSERT rows for themselves; only admins may SELECT.
  messfit_app is narrowed to INSERT + SELECT (RLS then limits SELECT to
  admins) — the blanket default grant from migration 013 would otherwise also
  allow UPDATE/DELETE of the log by the web process.

Revision ID: c7a2e9d41b60
Revises: b1e4a7c39d52
Create Date: 2026-09-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c7a2e9d41b60"
down_revision: Union[str, Sequence[str], None] = "b1e4a7c39d52"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_APP_ROLE = "messfit_app"


def upgrade() -> None:
    op.create_table(
        "analytics_events",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "props", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False
        ),
        sa.Column("occurred_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column(
            "received_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_analytics_events_occurred_at", "analytics_events", ["occurred_at"])
    op.create_index(
        "ix_analytics_events_name_occurred", "analytics_events", ["name", "occurred_at"]
    )
    op.create_index(
        "ix_analytics_events_user_occurred", "analytics_events", ["user_id", "occurred_at"]
    )

    op.execute("ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY analytics_events_insert_own ON analytics_events "
        "FOR INSERT WITH CHECK (user_id = auth.uid())"
    )
    op.execute(
        "CREATE POLICY analytics_events_admin_select ON analytics_events "
        "FOR SELECT USING (is_admin())"
    )

    op.execute(
        f"""
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{_APP_ROLE}') THEN
            REVOKE ALL ON analytics_events FROM {_APP_ROLE};
            GRANT INSERT, SELECT ON analytics_events TO {_APP_ROLE};
            GRANT USAGE, SELECT ON SEQUENCE analytics_events_id_seq TO {_APP_ROLE};
          END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS analytics_events_admin_select ON analytics_events")
    op.execute("DROP POLICY IF EXISTS analytics_events_insert_own ON analytics_events")
    op.drop_table("analytics_events")
