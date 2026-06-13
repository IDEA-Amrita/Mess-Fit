"""008 workouts

Exercises, workout templates, and workout logs (Phase 5).
- exercises / workout_templates: public reference data — public read, admin write
  (mirrors dishes/mess_menus RLS).
- workout_logs: per-user — owner or admin only (mirrors profiles/hostel_contexts).
Reuses set_updated_at() (migration 002) and is_admin().

Revision ID: d2e6a4b91c05
Revises: c1d5f3a82e94
Create Date: 2026-06-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "d2e6a4b91c05"
down_revision: Union[str, Sequence[str], None] = "c1d5f3a82e94"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── exercises ────────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE exercises (
          id                  TEXT PRIMARY KEY,
          name                TEXT NOT NULL,
          primary_muscle      TEXT NOT NULL,
          secondary_muscles   TEXT[] NOT NULL DEFAULT '{}',
          equipment           TEXT[] NOT NULL DEFAULT '{}',
          default_sets        INT NOT NULL,
          default_reps        TEXT NOT NULL,
          rest_seconds        INT NOT NULL DEFAULT 60,
          youtube_video_id    TEXT,
          instruction_text    TEXT,
          common_mistakes     TEXT[] NOT NULL DEFAULT '{}',
          created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TRIGGER trg_exercises_updated_at BEFORE UPDATE ON exercises
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    # ─── workout_templates ────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE workout_templates (
          id                   TEXT PRIMARY KEY,
          name                 TEXT NOT NULL,
          goal                 TEXT NOT NULL
                               CHECK (goal IN ('gain', 'lose', 'maintain')),
          equipment_required   TEXT[] NOT NULL DEFAULT '{}',
          duration_minutes     INT NOT NULL,
          days_per_week        INT NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
          structure            JSONB NOT NULL,
          created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TRIGGER trg_workout_templates_updated_at BEFORE UPDATE ON workout_templates
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """
    )

    # ─── workout_logs ─────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE workout_logs (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date            DATE NOT NULL,
          template_id     TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE RESTRICT,
          exercises_done  JSONB NOT NULL DEFAULT '[]'::jsonb,
          status          TEXT NOT NULL
                          CHECK (status IN ('done', 'partial', 'skipped')),
          skip_reason     TEXT,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, date, template_id)
        );

        CREATE INDEX idx_workout_logs_user_date ON workout_logs (user_id, date);
        """
    )

    # ─── Row-Level Security ───────────────────────────────────────────────
    op.execute(
        """
        ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
        CREATE POLICY exercises_public_read ON exercises FOR SELECT USING (true);
        CREATE POLICY exercises_admin_write ON exercises FOR INSERT WITH CHECK (is_admin());
        CREATE POLICY exercises_admin_update ON exercises FOR UPDATE USING (is_admin());
        CREATE POLICY exercises_admin_delete ON exercises FOR DELETE USING (is_admin());

        ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
        CREATE POLICY workout_templates_public_read ON workout_templates FOR SELECT USING (true);
        CREATE POLICY workout_templates_admin_write ON workout_templates FOR INSERT WITH CHECK (is_admin());
        CREATE POLICY workout_templates_admin_update ON workout_templates FOR UPDATE USING (is_admin());
        CREATE POLICY workout_templates_admin_delete ON workout_templates FOR DELETE USING (is_admin());

        ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY workout_logs_owner_read ON workout_logs
          FOR SELECT USING (user_id = auth.uid() OR is_admin());
        CREATE POLICY workout_logs_owner_write ON workout_logs
          FOR ALL USING (user_id = auth.uid() OR is_admin())
          WITH CHECK (user_id = auth.uid() OR is_admin());
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS workout_logs")
    op.execute("DROP TRIGGER IF EXISTS trg_workout_templates_updated_at ON workout_templates")
    op.execute("DROP TABLE IF EXISTS workout_templates")
    op.execute("DROP TRIGGER IF EXISTS trg_exercises_updated_at ON exercises")
    op.execute("DROP TABLE IF EXISTS exercises")
