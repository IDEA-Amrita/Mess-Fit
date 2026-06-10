"""add diet_type to dishes

Revision ID: b8c4e2a91f73
Revises: a3f9e2d74c01
Create Date: 2026-06-11

The optimizer's Dish contract has always required a diet_type field
(vegan / veg / egg / non_veg) so the solver can respect user preferences.
This migration adds the column that was missing from the initial schema.

Existing rows default to 'veg' (the most conservative safe choice).
"""

from typing import Sequence, Union

from alembic import op


revision: str = "b8c4e2a91f73"
down_revision: Union[str, Sequence[str], None] = "a3f9e2d74c01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE dishes
          ADD COLUMN diet_type TEXT NOT NULL DEFAULT 'veg'
            CHECK (diet_type IN ('vegan', 'veg', 'egg', 'non_veg'));
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE dishes DROP COLUMN diet_type;")
