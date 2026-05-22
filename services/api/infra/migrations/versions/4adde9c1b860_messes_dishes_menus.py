"""messes_dishes_menus

Revision ID: 4adde9c1b860
Revises: 00bc4bed1a1c
Create Date: 2026-05-22 23:27:25.707079

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '4adde9c1b860'
down_revision: Union[str, Sequence[str], None] = '00bc4bed1a1c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── dishes ───────────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE dishes (
          id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name                    TEXT NOT NULL,
          name_local              JSONB NOT NULL DEFAULT '{}'::jsonb,
          category                TEXT NOT NULL
                                  CHECK (category IN ('rice', 'roti', 'curry', 'sabzi', 'dal',
                                                      'snack', 'sweet', 'beverage', 'protein', 'salad', 'other')),
          default_serving_unit    TEXT NOT NULL,
          default_serving_grams   NUMERIC(6,2) NOT NULL CHECK (default_serving_grams > 0),
          kcal                    NUMERIC(6,2) NOT NULL CHECK (kcal >= 0),
          protein_g               NUMERIC(5,2) NOT NULL CHECK (protein_g >= 0),
          carbs_g                 NUMERIC(5,2) NOT NULL CHECK (carbs_g >= 0),
          fats_g                  NUMERIC(5,2) NOT NULL CHECK (fats_g >= 0),
          fiber_g                 NUMERIC(5,2) NOT NULL DEFAULT 0,
          sodium_mg               NUMERIC(6,2) NOT NULL DEFAULT 0,
          glycemic_index          INT CHECK (glycemic_index BETWEEN 0 AND 110),
          allergens               TEXT[] NOT NULL DEFAULT '{}',
          tags                    TEXT[] NOT NULL DEFAULT '{}',
          portion_icon            TEXT NOT NULL DEFAULT 'katori'
                                  CHECK (portion_icon IN ('katori', 'small_katori', 'fist',
                                                          'palm', 'thumb', 'cupped_hand',
                                                          'plate_quarter', 'piece', 'glass')),
          confidence              TEXT NOT NULL DEFAULT 'estimated'
                                  CHECK (confidence IN ('verified', 'estimated', 'user_reported')),
          source                  TEXT,
          created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (name, default_serving_unit)
        );

        CREATE TRIGGER trg_dishes_updated_at BEFORE UPDATE ON dishes
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();

        CREATE INDEX idx_dishes_tags ON dishes USING GIN (tags);
        CREATE INDEX idx_dishes_allergens ON dishes USING GIN (allergens);
        CREATE INDEX idx_dishes_name_trgm ON dishes USING GIN (name gin_trgm_ops);
        """
    )

    # ─── mess_menus ───────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE mess_menus (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          mess_id         UUID NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
          effective_from  DATE NOT NULL,
          effective_to    DATE,
          day_of_week     INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
          meal_type       TEXT NOT NULL
                          CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
          dish_id         UUID NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
          availability    TEXT NOT NULL DEFAULT 'usually'
                          CHECK (availability IN ('always', 'usually', 'sometimes')),
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (mess_id, effective_from, day_of_week, meal_type, dish_id)
        );

        CREATE TRIGGER trg_mess_menus_updated_at BEFORE UPDATE ON mess_menus
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();

        CREATE INDEX idx_mess_menus_lookup
          ON mess_menus (mess_id, day_of_week, meal_type);
        """
    )

    # ─── Row-Level Security ───────────────────────────────────────────────
    op.execute(
        """
        ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
        CREATE POLICY dishes_public_read ON dishes FOR SELECT USING (true);
        CREATE POLICY dishes_admin_write ON dishes FOR INSERT WITH CHECK (is_admin());
        CREATE POLICY dishes_admin_update ON dishes FOR UPDATE USING (is_admin());
        CREATE POLICY dishes_admin_delete ON dishes FOR DELETE USING (is_admin());

        ALTER TABLE mess_menus ENABLE ROW LEVEL SECURITY;
        CREATE POLICY mess_menus_public_read ON mess_menus FOR SELECT USING (true);
        CREATE POLICY mess_menus_admin_write ON mess_menus FOR INSERT WITH CHECK (is_admin());
        CREATE POLICY mess_menus_admin_update ON mess_menus FOR UPDATE USING (is_admin());
        CREATE POLICY mess_menus_admin_delete ON mess_menus FOR DELETE USING (is_admin());
        """
    )


def downgrade() -> None:
    # Drop in reverse order
    op.execute("DROP TRIGGER IF EXISTS trg_mess_menus_updated_at ON mess_menus")
    op.drop_table("mess_menus")

    op.execute("DROP TRIGGER IF EXISTS trg_dishes_updated_at ON dishes")
    op.drop_table("dishes")
