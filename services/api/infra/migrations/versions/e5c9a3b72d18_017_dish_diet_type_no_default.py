"""017 dishes.diet_type — drop the 'veg' default

Migration 006 added diet_type with DEFAULT 'veg', so any dish inserted without
a label silently became vegetarian and could be recommended to a vegetarian
user. Every insert path now sets it explicitly (admin create requires it; AI
estimates fall back to 'non_veg'), and without a default a missing label is a
NOT NULL error instead of a wrong answer. Existing rows are untouched.

Revision ID: e5c9a3b72d18
Revises: d4b8f2a61e73
Create Date: 2026-09-29
"""

from typing import Sequence, Union

from alembic import op

revision: str = "e5c9a3b72d18"
down_revision: Union[str, Sequence[str], None] = "d4b8f2a61e73"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE dishes ALTER COLUMN diet_type DROP DEFAULT")


def downgrade() -> None:
    op.execute("ALTER TABLE dishes ALTER COLUMN diet_type SET DEFAULT 'veg'")
