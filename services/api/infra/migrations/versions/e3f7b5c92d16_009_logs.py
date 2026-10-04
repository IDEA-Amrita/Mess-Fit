"""009 logs

Meal, weight, and subjective logs (Phase 6). workout_logs was already created in
migration 008. All three tables are per-user — owner or admin only (mirrors
workout_logs / profiles RLS). Reuses is_admin() (migration 002).

meal_logs extends SCHEMA §5.8 with nullable macro-snapshot columns
(kcal/protein_g/carbs_g/fats_g): the optimizer plan lives only in Redis, so the
client sends the planned meal's macros when status='as_planned'. These power the
progress dashboard's macro-hit rate. NULL for 'different'/'skipped'.

Revision ID: e3f7b5c92d16
Revises: d2e6a4b91c05
Create Date: 2026-06-14 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "e3f7b5c92d16"
down_revision: Union[str, Sequence[str], None] = "d2e6a4b91c05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── meal_logs ────────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE meal_logs (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date        DATE NOT NULL,
          meal_type   TEXT NOT NULL
                      CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
          status      TEXT NOT NULL
                      CHECK (status IN ('as_planned', 'different', 'skipped')),
          notes       TEXT,
          photo_url   TEXT,                                       -- V2 use
          -- macro snapshot of the planned meal (client-supplied when as_planned)
          kcal        NUMERIC(7,2),
          protein_g   NUMERIC(6,2),
          carbs_g     NUMERIC(6,2),
          fats_g      NUMERIC(6,2),
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, date, meal_type)
        );

        CREATE INDEX idx_meal_logs_user_date ON meal_logs (user_id, date DESC);
        """
    )

    # ─── weight_logs ──────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE weight_logs (
          user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date        DATE NOT NULL,
          weight_kg   NUMERIC(5,2) NOT NULL CHECK (weight_kg BETWEEN 30 AND 200),
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, date)
        );

        CREATE INDEX idx_weight_logs_user_date ON weight_logs (user_id, date DESC);
        """
    )

    # ─── subjective_logs ──────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE subjective_logs (
          user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date        DATE NOT NULL,
          energy      INT CHECK (energy BETWEEN 1 AND 5),
          hunger      INT CHECK (hunger BETWEEN 1 AND 5),
          mood        INT CHECK (mood BETWEEN 1 AND 5),
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, date)
        );
        """
    )

    # ─── Row-Level Security (per-user owner or admin) ─────────────────────
    op.execute(
        """
        ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY meal_logs_owner_read ON meal_logs
          FOR SELECT USING (user_id = auth.uid() OR is_admin());
        CREATE POLICY meal_logs_owner_write ON meal_logs
          FOR ALL USING (user_id = auth.uid() OR is_admin())
          WITH CHECK (user_id = auth.uid() OR is_admin());

        ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY weight_logs_owner_read ON weight_logs
          FOR SELECT USING (user_id = auth.uid() OR is_admin());
        CREATE POLICY weight_logs_owner_write ON weight_logs
          FOR ALL USING (user_id = auth.uid() OR is_admin())
          WITH CHECK (user_id = auth.uid() OR is_admin());

        ALTER TABLE subjective_logs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY subjective_logs_owner_read ON subjective_logs
          FOR SELECT USING (user_id = auth.uid() OR is_admin());
        CREATE POLICY subjective_logs_owner_write ON subjective_logs
          FOR ALL USING (user_id = auth.uid() OR is_admin())
          WITH CHECK (user_id = auth.uid() OR is_admin());
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS subjective_logs")
    op.execute("DROP TABLE IF EXISTS weight_logs")
    op.execute("DROP TABLE IF EXISTS meal_logs")
