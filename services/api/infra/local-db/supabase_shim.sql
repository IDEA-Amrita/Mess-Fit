-- Minimal stand-in for what a Supabase project already has, so the Alembic
-- chain can build a database from scratch on plain Postgres (pgvector image):
-- CI, local test databases, and `docker compose` dev. NEVER run this against
-- a real Supabase project — there these objects exist and belong to Supabase.
--
-- Only what the migrations touch is modelled:
--   * auth.users (003/014 add sync triggers to it and backfill from it)
--   * the Data API roles anon/authenticated, with Supabase's default grants,
--     so migration 018 (which revokes them) is exercised for real.
--   * the app's own login roles (013 creates them without passwords when
--     missing; in production an operator sets real ones). Test-only passwords
--     here let the suite connect as messfit_app, so RLS is enforced in tests
--     exactly as in production instead of being bypassed by a superuser.
-- auth.uid() is created by migration 002's own local shim.

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id                 uuid PRIMARY KEY,
    email              text,
    raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'messfit_app') THEN
    CREATE ROLE messfit_app WITH LOGIN PASSWORD 'messfit_app'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'messfit_worker') THEN
    CREATE ROLE messfit_worker WITH LOGIN PASSWORD 'messfit_worker'
      NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS NOREPLICATION;
  END IF;
END
$$;
