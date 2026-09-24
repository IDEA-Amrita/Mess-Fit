"""013 least-privilege app roles + RLS on users

Closes out the RLS audit finding: the app's DATABASE_URL connects as the
Postgres superuser (`postgres`), which bypasses Row-Level Security
unconditionally — no policy, and no SET LOCAL session variable, can ever
change that. RLS being "possibly inert" wasn't a code bug alone; it was
also a role problem. This migration:

1. Fixes the local-dev auth.uid() shim (migration 002) to match Supabase's
   *actual* production convention. The shim reads a flat session variable
   (`request.jwt.claim.sub`) — an older PostgREST convention. Real Supabase
   projects' own auth.uid() reads a JSON blob instead
   (`request.jwt.claims::json->>'sub'`). Left as-is, local dev and
   production would have silently disagreed about how to authenticate RLS
   context, even after the app started setting a session variable —
   whichever variable it set, it would have been wrong for one environment
   or the other. Only touches OUR shim (matched by its old source text);
   never touches Supabase's real auth.uid() if it already exists.

2. Enables RLS on `users` — the one table that never had it, despite every
   other user-owned table in this schema following that pattern since
   migration 002.

3. Creates two new least-privilege Postgres roles, matching the
   authenticated/service_role split Supabase's own API layer uses:
   - `messfit_app`  — for the FastAPI web process. NOT superuser, NOT
     BYPASSRLS. Subject to every RLS policy in this schema. Column-level
     grants on `users` deliberately exclude `role`, so even a compromised
     app process can't self-escalate a user to admin via a legitimate
     UPDATE path.
   - `messfit_worker` — for Celery background tasks (the account-deletion
     sweep, OCR draft-dish creation, notification dispatch), which run on
     a schedule with no authenticated user in context and legitimately
     need cross-user access. BYPASSRLS, not superuser.

   Role passwords are deliberately NOT set here — set them via the
   Supabase SQL editor (`ALTER ROLE ... WITH PASSWORD '...'`) so a real
   credential never touches version control. See the PR description for
   the full cutover steps.

Revision ID: f9c31e5a7b48
Revises: 37b4567e3693
Create Date: 2026-08-31
"""

from typing import Sequence, Union

from alembic import op

revision: str = "f9c31e5a7b48"
down_revision: Union[str, Sequence[str], None] = "37b4567e3693"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_APP_ROLE = "messfit_app"
_WORKER_ROLE = "messfit_worker"


def upgrade() -> None:
    # ─── 1. Fix the local-dev auth.uid() shim ──────────────────────────────
    # Only replaces a function whose source is recognizably OUR old shim
    # (reads ONLY the old flat-key setting). Supabase's own auth.uid() reads
    # the flat key too, as a fallback, but ALSO the `request.jwt.claims` blob,
    # so requiring that blob to be absent keeps us from touching it (the
    # postgres role can't: schema auth belongs to supabase_auth_admin).
    op.execute(
        """
        DO $$
        DECLARE
          fn_src text;
        BEGIN
          SELECT p.prosrc INTO fn_src
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'auth' AND p.proname = 'uid';

          IF fn_src IS NULL OR (
            fn_src LIKE '%request.jwt.claim.sub%'
            AND fn_src NOT LIKE '%request.jwt.claims%'
          ) THEN
            CREATE OR REPLACE FUNCTION auth.uid()
            RETURNS UUID AS $body$
              SELECT NULLIF(
                current_setting('request.jwt.claims', TRUE)::json->>'sub', ''
              )::UUID
            $body$ LANGUAGE sql STABLE;
          END IF;
        END
        $$;
        """
    )

    # ─── 2. RLS on users ────────────────────────────────────────────────────
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY users_self_select ON users "
        "FOR SELECT USING (id = auth.uid() OR is_admin())"
    )
    op.execute(
        "CREATE POLICY users_self_update ON users "
        "FOR UPDATE USING (id = auth.uid() OR is_admin()) "
        "WITH CHECK (id = auth.uid() OR is_admin())"
    )
    # is_admin() itself is SECURITY DEFINER (migration 002) — it reads
    # `users` with the privileges of whoever owns the function, not the
    # caller, so it isn't circularly blocked by the policy it's used in.

    # ─── 3a. messfit_app — the web process, RLS-constrained ────────────────
    op.execute(
        f"""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{_APP_ROLE}') THEN
            CREATE ROLE {_APP_ROLE} WITH LOGIN NOSUPERUSER NOCREATEDB
              NOCREATEROLE NOBYPASSRLS NOREPLICATION;
          END IF;
        END
        $$;
        """
    )
    op.execute(f"GRANT USAGE ON SCHEMA public TO {_APP_ROLE}")
    op.execute(
        f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {_APP_ROLE}"
    )
    op.execute(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {_APP_ROLE}")
    op.execute(
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {_APP_ROLE}"
    )
    op.execute(
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        f"GRANT USAGE, SELECT ON SEQUENCES TO {_APP_ROLE}"
    )
    # Narrow `users` specifically. App code never INSERTs or DELETEs a users
    # row directly (that's the Supabase auth trigger's job, which runs
    # SECURITY DEFINER as its owner, not as messfit_app) or UPDATEs `role`
    # (RLS is row-level only — it can't stop `role` from riding along in a
    # legitimate self-UPDATE statement; column-level GRANT is what does).
    # The blanket grant above gave messfit_app all of that by default —
    # revoke everything on this one table and re-grant exactly what's used.
    op.execute(f"REVOKE ALL ON users FROM {_APP_ROLE}")
    op.execute(f"GRANT SELECT ON users TO {_APP_ROLE}")
    op.execute(f"GRANT UPDATE (deleted_at, onboarded_at) ON users TO {_APP_ROLE}")

    # ─── 3b. messfit_worker — Celery, cross-user by design ──────────────────
    op.execute(
        f"""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{_WORKER_ROLE}') THEN
            CREATE ROLE {_WORKER_ROLE} WITH LOGIN NOSUPERUSER NOCREATEDB
              NOCREATEROLE BYPASSRLS NOREPLICATION;
          END IF;
        END
        $$;
        """
    )
    op.execute(f"GRANT USAGE ON SCHEMA public TO {_WORKER_ROLE}")
    op.execute(
        f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {_WORKER_ROLE}"
    )
    op.execute(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {_WORKER_ROLE}")
    op.execute(
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {_WORKER_ROLE}"
    )
    op.execute(
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        f"GRANT USAGE, SELECT ON SEQUENCES TO {_WORKER_ROLE}"
    )


def downgrade() -> None:
    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM {_WORKER_ROLE}")
    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM {_WORKER_ROLE}")
    op.execute(f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {_WORKER_ROLE}")
    op.execute(f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {_WORKER_ROLE}")
    op.execute(f"REVOKE USAGE ON SCHEMA public FROM {_WORKER_ROLE}")
    op.execute(f"DROP ROLE IF EXISTS {_WORKER_ROLE}")

    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM {_APP_ROLE}")
    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM {_APP_ROLE}")
    op.execute(f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {_APP_ROLE}")
    op.execute(f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {_APP_ROLE}")
    op.execute(f"REVOKE USAGE ON SCHEMA public FROM {_APP_ROLE}")
    op.execute(f"DROP ROLE IF EXISTS {_APP_ROLE}")

    op.execute("DROP POLICY IF EXISTS users_self_update ON users")
    op.execute("DROP POLICY IF EXISTS users_self_select ON users")
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY")

    # Deliberately does not revert the auth.uid() fix — the JSON-claims
    # convention is correct in both environments; reverting would
    # reintroduce the local/prod mismatch this migration fixed.
