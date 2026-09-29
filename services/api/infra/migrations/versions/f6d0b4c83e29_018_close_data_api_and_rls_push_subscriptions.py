"""018 close the Supabase Data API to app tables; RLS on push_subscriptions

1. Supabase grants its API roles (`anon`, `authenticated`) ALL on every table
   created in `public`, and exposes them through its REST Data API. MessFit
   never uses that API for app data (every read/write goes through FastAPI as
   messfit_app, see migration 013; the browser only uses Supabase Auth and
   Storage), so those grants were pure attack surface:
     - any table without RLS was readable with the public anon key
       (push_subscriptions: every user's push endpoint + keys);
     - a signed-in user could write their own rows directly, skipping the
       API's validation, including `users.role` (RLS allows self-update; only
       messfit_app had the column-level restriction from 013).
   Revoked here, for existing and future tables. Guarded so local Postgres
   (no Supabase roles) is unaffected.

2. push_subscriptions gets own-row RLS like every other per-user table. The
   worker (BYPASSRLS) still reads all rows for scheduled pushes.

3. A browser's subscription legitimately moves between accounts: whoever is
   signed in re-registers it (shared hostel computers). Own-row RLS alone would
   block taking over a row that still names the previous user, so
   claim_push_subscription() does that one upsert as the table owner, always
   for auth.uid(). Holding the endpoint URL and keys is the proof of control.

Revision ID: f6d0b4c83e29
Revises: e5c9a3b72d18
Create Date: 2026-09-29
"""

from typing import Sequence, Union

from alembic import op

revision: str = "f6d0b4c83e29"
down_revision: Union[str, Sequence[str], None] = "e5c9a3b72d18"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_APP_ROLE = "messfit_app"
_API_ROLES = ("anon", "authenticated")


def upgrade() -> None:
    # ─── 1. Supabase Data API roles lose access to app objects ─────────────
    for role in _API_ROLES:
        op.execute(
            f"""
            DO $$
            BEGIN
              IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN
                REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {role};
                REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {role};
                ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM {role};
                ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM {role};
              END IF;
            END
            $$;
            """
        )

    # ─── 2. own-row RLS ─────────────────────────────────────────────────────
    op.execute("ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY push_subscriptions_own ON push_subscriptions "
        "FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())"
    )

    # ─── 3. hand a browser's subscription to whoever is signed in ───────────
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.claim_push_subscription(
          p_endpoint text, p_p256dh text, p_auth text
        ) RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public, pg_temp
        AS $$
        DECLARE
          caller uuid := auth.uid();
        BEGIN
          IF caller IS NULL THEN
            RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
          END IF;
          INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
          VALUES (caller, p_endpoint, p_p256dh, p_auth)
          ON CONFLICT (endpoint) DO UPDATE
            SET user_id = EXCLUDED.user_id,
                p256dh  = EXCLUDED.p256dh,
                auth    = EXCLUDED.auth;
        END
        $$;
        """
    )
    op.execute("REVOKE ALL ON FUNCTION public.claim_push_subscription(text, text, text) FROM PUBLIC")
    for role in _API_ROLES:
        op.execute(
            f"""
            DO $$
            BEGIN
              IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN
                REVOKE ALL ON FUNCTION public.claim_push_subscription(text, text, text) FROM {role};
              END IF;
            END
            $$;
            """
        )
    op.execute(
        f"""
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{_APP_ROLE}') THEN
            GRANT EXECUTE ON FUNCTION public.claim_push_subscription(text, text, text) TO {_APP_ROLE};
          END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS public.claim_push_subscription(text, text, text)")
    op.execute("DROP POLICY IF EXISTS push_subscriptions_own ON push_subscriptions")
    op.execute("ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY")
    # The Data API grants are deliberately not restored: re-exposing app
    # tables to the public anon key is never the desired state.
