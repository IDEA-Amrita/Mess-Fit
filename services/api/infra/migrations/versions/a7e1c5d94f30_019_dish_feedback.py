"""019 dish_feedback — bring the crowdsourced "is this dish served?" votes into the chain

The table existed only as a hand-run script (services/api/migrations/
dish_feedback.sql) while the API and the Plate/Menu pages already used it, so
any database built by `alembic upgrade head` — a new environment, CI, a
restored backup — lacked it and those endpoints failed. Everything here is
IF NOT EXISTS, so a database where the script was already run is unaffected.

Access (RLS, like every other table since 013/018):
  - a signed-in user may write only their own vote;
  - any signed-in user may read all votes, because the API only ever returns
    per-dish totals (confirms / denies), never who voted.

Revision ID: a7e1c5d94f30
Revises: f6d0b4c83e29
Create Date: 2026-09-29
"""

from typing import Sequence, Union

from alembic import op

revision: str = "a7e1c5d94f30"
down_revision: Union[str, Sequence[str], None] = "f6d0b4c83e29"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS dish_feedback (
            user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            date       date        NOT NULL,
            meal_type  text        NOT NULL
                       CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
            dish_id    uuid        NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
            vote       text        NOT NULL CHECK (vote IN ('confirm', 'deny')),
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, date, meal_type, dish_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_dish_feedback_lookup "
        "ON dish_feedback (date, meal_type, dish_id)"
    )

    op.execute("ALTER TABLE dish_feedback ENABLE ROW LEVEL SECURITY")
    for name in ("dish_feedback_read", "dish_feedback_write_own", "dish_feedback_update_own", "dish_feedback_delete_own"):
        op.execute(f"DROP POLICY IF EXISTS {name} ON dish_feedback")
    op.execute("CREATE POLICY dish_feedback_read ON dish_feedback FOR SELECT USING (auth.uid() IS NOT NULL)")
    op.execute("CREATE POLICY dish_feedback_write_own ON dish_feedback FOR INSERT WITH CHECK (user_id = auth.uid())")
    op.execute(
        "CREATE POLICY dish_feedback_update_own ON dish_feedback FOR UPDATE "
        "USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())"
    )
    op.execute("CREATE POLICY dish_feedback_delete_own ON dish_feedback FOR DELETE USING (user_id = auth.uid())")

    # A table created by the hand-run script predates migration 018's revoke
    # only if the script ran after 018; revoke here too so it's never exposed.
    for role in ("anon", "authenticated"):
        op.execute(
            f"""
            DO $$
            BEGIN
              IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN
                REVOKE ALL ON dish_feedback FROM {role};
              END IF;
            END
            $$;
            """
        )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS dish_feedback")
