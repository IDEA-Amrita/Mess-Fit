"""014 sync auth.users to public.users on UPDATE, not just INSERT

Migration 003 mirrors a new Supabase ``auth.users`` row into ``public.users``
on INSERT, but nothing kept it in sync afterwards. When a user changes their
display name in Settings (``supabase.auth.updateUser({data:{display_name}})``),
that only updates ``auth.users.raw_user_meta_data`` — ``public.users`` (the
table everything else, including the leaderboard, reads from) silently went
stale from that point on.

This redefines migration 003's sync function to upsert (``ON CONFLICT DO
UPDATE`` instead of ``DO NOTHING``) so the same function is correct for both
an INSERT and an UPDATE trigger, adds the matching AFTER UPDATE trigger, and
backfills every existing row once so already-stale names are corrected
immediately rather than waiting for the next profile edit.

Revision ID: b1e4a7c39d52
Revises: f9c31e5a7b48
"""

from typing import Sequence, Union

from alembic import op


revision: str = "b1e4a7c39d52"
down_revision: Union[str, Sequence[str], None] = "f9c31e5a7b48"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Redefine the migration-003 function: DO NOTHING was correct for an
    # INSERT-only trigger, but the same function is now also wired to UPDATE,
    # where the row already exists — it needs to overwrite, not skip.
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
            COALESCE(
              NEW.raw_user_meta_data->>'full_name',
              NEW.raw_user_meta_data->>'name',
              NEW.raw_user_meta_data->>'display_name',
              split_part(NEW.email, '@', 1)
            )
          )
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            display_name = EXCLUDED.display_name,
            updated_at = now();
          RETURN NEW;
        END;
        $$;
        """
    )

    op.execute("DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users")
    op.execute(
        """
        CREATE TRIGGER on_auth_user_updated
          AFTER UPDATE ON auth.users
          FOR EACH ROW
          WHEN (
            NEW.email IS DISTINCT FROM OLD.email
            OR NEW.raw_user_meta_data IS DISTINCT FROM OLD.raw_user_meta_data
          )
          EXECUTE FUNCTION public.handle_new_auth_user();
        """
    )

    # One-time backfill for rows that already drifted before this migration.
    op.execute(
        """
        UPDATE public.users pu
        SET
          email = au.email,
          display_name = COALESCE(
            au.raw_user_meta_data->>'full_name',
            au.raw_user_meta_data->>'name',
            au.raw_user_meta_data->>'display_name',
            split_part(au.email, '@', 1)
          ),
          updated_at = now()
        FROM auth.users au
        WHERE pu.id = au.id
          AND (
            pu.email IS DISTINCT FROM au.email
            OR pu.display_name IS DISTINCT FROM COALESCE(
              au.raw_user_meta_data->>'full_name',
              au.raw_user_meta_data->>'name',
              au.raw_user_meta_data->>'display_name',
              split_part(au.email, '@', 1)
            )
          );
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users")
    # Restore the migration-003 DO-NOTHING behaviour (INSERT-only semantics).
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
    # No data downgrade — a corrected display_name/email is strictly more
    # accurate than the stale value it replaced; reverting it would reintroduce
    # the bug this migration fixes.
