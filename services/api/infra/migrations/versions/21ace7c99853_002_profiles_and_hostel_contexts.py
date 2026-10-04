"""002 profiles and hostel_contexts

Adds:
- helper function ``set_updated_at()`` (re-used by every table with an
  ``updated_at`` column)
- local-dev stub for ``auth.uid()`` so RLS policies work without Supabase
- helper ``is_admin()`` used by every RLS policy
- ``messes`` table (minimal — Phase 2 will seed it and add menus)
- ``profiles`` table (per-user health/diet/goal data)
- ``hostel_contexts`` table (per-user mess + canteen + equipment context)
- Row-Level Security on profiles + hostel_contexts (user A cannot read
  user B's data even if a bug elsewhere tries)

Revision ID: 21ace7c99853
Revises: 9df75b12fd10
Create Date: 2026-05-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "21ace7c99853"
down_revision: Union[str, Sequence[str], None] = "9df75b12fd10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── helpers ──────────────────────────────────────────────────────────
    # Trigger function: bump updated_at on every UPDATE.
    # Re-used by every table that has an updated_at column.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # Local-dev shim for auth.uid().
    # In Supabase the auth schema already provides auth.uid() out of
    # the box. We DO NOT want to overwrite it. Locally (plain Postgres)
    # we install a fallback that returns the JWT sub claim if one was
    # set via SET LOCAL, otherwise NULL — which makes RLS fall back to
    # the admin check.
    op.execute("CREATE SCHEMA IF NOT EXISTS auth")
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'auth' AND p.proname = 'uid'
          ) THEN
            CREATE FUNCTION auth.uid()
            RETURNS UUID AS $body$
              SELECT NULLIF(
                current_setting('request.jwt.claim.sub', TRUE), ''
              )::UUID
            $body$ LANGUAGE sql STABLE;
          END IF;
        END
        $$;
        """
    )

    # is_admin() — used by every RLS policy as the admin override.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION is_admin()
        RETURNS BOOLEAN AS $$
          SELECT EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND role = 'admin'
          );
        $$ LANGUAGE SQL STABLE SECURITY DEFINER;
        """
    )

    # ─── messes ───────────────────────────────────────────────────────────
    op.create_table(
        "messes",
        sa.Column(
            "id",
            sa.UUID(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("college", sa.Text(), nullable=False),
        sa.Column("city", sa.Text(), nullable=False),
        sa.Column("seeded_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.UniqueConstraint("college", "name", name="messes_college_name_unique"),
    )
    op.execute(
        "CREATE TRIGGER trg_messes_updated_at "
        "BEFORE UPDATE ON messes "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )

    # ─── profiles ─────────────────────────────────────────────────────────
    op.create_table(
        "profiles",
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("dob", sa.Date(), nullable=False),
        sa.Column("sex", sa.Text(), nullable=False),
        sa.Column("height_cm", sa.Numeric(5, 2), nullable=False),
        sa.Column("current_weight_kg", sa.Numeric(5, 2), nullable=False),
        sa.Column("target_weight_kg", sa.Numeric(5, 2), nullable=False),
        sa.Column("target_rate_kg_per_week", sa.Numeric(3, 2), nullable=False),
        sa.Column("goal", sa.Text(), nullable=False),
        sa.Column("activity_level", sa.Integer(), nullable=False),
        sa.Column("diet_type", sa.Text(), nullable=False),
        sa.Column(
            "allergies",
            sa.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column(
            "conditions",
            sa.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.CheckConstraint("sex IN ('male', 'female', 'other')", name="profiles_sex_check"),
        sa.CheckConstraint("height_cm BETWEEN 120 AND 220", name="profiles_height_check"),
        sa.CheckConstraint(
            "current_weight_kg BETWEEN 30 AND 200",
            name="profiles_current_weight_check",
        ),
        sa.CheckConstraint(
            "target_weight_kg BETWEEN 30 AND 200",
            name="profiles_target_weight_check",
        ),
        sa.CheckConstraint(
            "target_rate_kg_per_week BETWEEN -0.5 AND 0.5",
            name="profiles_target_rate_check",
        ),
        sa.CheckConstraint("goal IN ('lose', 'maintain', 'gain')", name="profiles_goal_check"),
        sa.CheckConstraint("activity_level BETWEEN 1 AND 5", name="profiles_activity_check"),
        sa.CheckConstraint(
            "diet_type IN ('veg', 'eggetarian', 'non_veg', 'jain')",
            name="profiles_diet_check",
        ),
    )
    op.execute(
        "CREATE TRIGGER trg_profiles_updated_at "
        "BEFORE UPDATE ON profiles "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )

    # ─── hostel_contexts ──────────────────────────────────────────────────
    op.create_table(
        "hostel_contexts",
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "mess_id",
            sa.UUID(),
            sa.ForeignKey("messes.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("canteen_freq", sa.Text(), nullable=False),
        sa.Column(
            "canteen_typical_spend_inr",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "top_up_budget_inr_weekly",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "equipment",
            sa.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column(
            "workout_minutes_per_day",
            sa.Integer(),
            nullable=False,
            server_default="30",
        ),
        sa.Column(
            "workout_days_per_week",
            sa.Integer(),
            nullable=False,
            server_default="3",
        ),
        sa.Column(
            "gym_access_days",
            sa.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.CheckConstraint(
            "canteen_freq IN ('never', 'rare', 'frequent', 'daily')",
            name="hostel_canteen_freq_check",
        ),
        sa.CheckConstraint("canteen_typical_spend_inr >= 0", name="hostel_canteen_spend_check"),
        sa.CheckConstraint("top_up_budget_inr_weekly >= 0", name="hostel_top_up_check"),
        sa.CheckConstraint(
            "workout_minutes_per_day BETWEEN 0 AND 180",
            name="hostel_workout_minutes_check",
        ),
        sa.CheckConstraint(
            "workout_days_per_week BETWEEN 0 AND 7",
            name="hostel_workout_days_check",
        ),
    )
    op.execute(
        "CREATE TRIGGER trg_hostel_updated_at "
        "BEFORE UPDATE ON hostel_contexts "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )

    # ─── Row-Level Security ───────────────────────────────────────────────
    # profiles
    op.execute("ALTER TABLE profiles ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY profiles_self_select ON profiles "
        "FOR SELECT USING (user_id = auth.uid() OR is_admin())"
    )
    op.execute(
        "CREATE POLICY profiles_self_modify ON profiles "
        "FOR ALL USING (user_id = auth.uid() OR is_admin()) "
        "WITH CHECK (user_id = auth.uid() OR is_admin())"
    )

    # hostel_contexts
    op.execute("ALTER TABLE hostel_contexts ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY hostel_self_select ON hostel_contexts "
        "FOR SELECT USING (user_id = auth.uid() OR is_admin())"
    )
    op.execute(
        "CREATE POLICY hostel_self_modify ON hostel_contexts "
        "FOR ALL USING (user_id = auth.uid() OR is_admin()) "
        "WITH CHECK (user_id = auth.uid() OR is_admin())"
    )

    # messes — public read, admin write
    op.execute("ALTER TABLE messes ENABLE ROW LEVEL SECURITY")
    op.execute("CREATE POLICY messes_public_read ON messes FOR SELECT USING (true)")
    op.execute("CREATE POLICY messes_admin_write ON messes FOR INSERT WITH CHECK (is_admin())")
    op.execute("CREATE POLICY messes_admin_update ON messes FOR UPDATE USING (is_admin())")
    op.execute("CREATE POLICY messes_admin_delete ON messes FOR DELETE USING (is_admin())")


def downgrade() -> None:
    # Drop in reverse order (FK-dependent things first)
    op.execute("DROP TRIGGER IF EXISTS trg_hostel_updated_at ON hostel_contexts")
    op.drop_table("hostel_contexts")

    op.execute("DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles")
    op.drop_table("profiles")

    op.execute("DROP TRIGGER IF EXISTS trg_messes_updated_at ON messes")
    op.drop_table("messes")

    op.execute("DROP FUNCTION IF EXISTS is_admin()")
    # Note: we deliberately do NOT drop auth.uid() — on Supabase this
    # function is owned by the auth system and dropping it would break
    # the entire project. The CREATE in upgrade() is conditional anyway,
    # so re-running the migration is safe.
    op.execute("DROP FUNCTION IF EXISTS set_updated_at()")
