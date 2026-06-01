"""005_dish_exclusions

Adds the dish_exclusions table so users can mark a dish as unavailable
for a specific meal on a specific date. The Phase 3 optimizer reads this
table to exclude dishes from the recommendation set before solving.

Revision ID: a3f9e2d74c01
Revises: 4adde9c1b860
Create Date: 2026-06-01
"""

from typing import Sequence, Union

from alembic import op


revision: str = "a3f9e2d74c01"
down_revision: Union[str, Sequence[str], None] = "4adde9c1b860"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE dish_exclusions (
          user_id    UUID    NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
          date       DATE    NOT NULL,
          meal_type  TEXT    NOT NULL
                             CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
          dish_id    UUID    NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, date, meal_type, dish_id)
        );

        CREATE INDEX idx_dish_exclusions_user_date
          ON dish_exclusions (user_id, date);

        ALTER TABLE dish_exclusions ENABLE ROW LEVEL SECURITY;
        CREATE POLICY dish_excl_self ON dish_exclusions
          FOR ALL USING (user_id = auth.uid());
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS dish_exclusions")
