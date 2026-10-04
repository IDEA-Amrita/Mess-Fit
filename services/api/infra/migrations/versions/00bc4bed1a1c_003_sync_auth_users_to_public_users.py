"""003 sync auth.users to public.users

Adds a trigger that mirrors every Supabase ``auth.users`` row into
``public.users``, so our FK-dependent tables (``profiles``,
``hostel_contexts``, etc) always have a valid row to point at.

Without this, the very first PUT /api/v1/profile/me from a freshly
signed-up user fails with:

    insert or update on table "profiles" violates foreign key
    constraint "profiles_user_id_fkey"
    DETAIL: Key (user_id)=(...) is not present in table "users".

The trigger is idempotent (ON CONFLICT DO NOTHING). We also backfill
any existing auth.users rows on upgrade so already-signed-up users
work without re-registering.

Revision ID: 00bc4bed1a1c
Revises: 21ace7c99853
"""

from typing import Sequence, Union

from alembic import op


revision: str = "00bc4bed1a1c"
down_revision: Union[str, Sequence[str], None] = "21ace7c99853"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Trigger function: copy a new auth user into public.users ──
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
          INSERT INTO public.users (id, email, display_name)
          VALUES (
            NEW.id,
            NEW.email,
            -- Prefer Google/GitHub display name from OAuth metadata,
            -- fall back to anything the signup form passed in,
            -- finally fall back to the email's local part.
            COALESCE(
              NEW.raw_user_meta_data->>'full_name',
              NEW.raw_user_meta_data->>'name',
              NEW.raw_user_meta_data->>'display_name',
              split_part(NEW.email, '@', 1)
            )
          )
          ON CONFLICT (id) DO NOTHING;
          RETURN NEW;
        END;
        $$;
        """
    )

    # ── 2. Drop the trigger if it already exists, then create it ──
    # CREATE TRIGGER doesn't support OR REPLACE, so we DROP first.
    op.execute("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users")
    op.execute(
        """
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
        """
    )

    # ── 3. Backfill: copy every existing auth.users row that's not
    #       already mirrored into public.users.
    op.execute(
        """
        INSERT INTO public.users (id, email, display_name)
        SELECT
          au.id,
          au.email,
          COALESCE(
            au.raw_user_meta_data->>'full_name',
            au.raw_user_meta_data->>'name',
            au.raw_user_meta_data->>'display_name',
            split_part(au.email, '@', 1)
          )
        FROM auth.users au
        LEFT JOIN public.users pu ON pu.id = au.id
        WHERE pu.id IS NULL;
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users")
    op.execute("DROP FUNCTION IF EXISTS public.handle_new_auth_user()")
    # We do NOT delete the public.users rows we backfilled — the FKs
    # from profiles/hostel_contexts depend on them, and dropping rows
    # would cascade-delete user data.
