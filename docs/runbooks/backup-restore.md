# Runbook: Backup & Restore

**Scope:** Verify MessFit's Postgres (Supabase) backups are restorable. Run the
drill once, then re-run after any major schema change. This is the Phase 9 task
9.9 quality gate.

## Backups in place
- **Supabase automated backups** — daily, retained per plan (Pro = PITR; Free =
  daily snapshot). Confirm under **Project → Database → Backups**.
- Schema is reproducible from `services/api/infra/migrations` (`alembic upgrade
  head`), so a restore can also be rebuilt + reseeded if needed.

## Restore drill (do once, document the result)
1. **Snapshot** — Supabase dashboard → Database → Backups → take/download a
   manual backup (or note the latest automated one).
2. **Fresh target** — create a throwaway Supabase project (free tier) or a local
   `postgres:16` container.
3. **Restore** —
   - Supabase-to-Supabase: use the dashboard restore, or
   - Logical: `pg_restore` / `psql < dump.sql` against the target
     `DATABASE_URL`.
4. **Verify row counts** against production (run on both, compare):
   ```sql
   SELECT
     (SELECT count(*) FROM users)          AS users,
     (SELECT count(*) FROM profiles)       AS profiles,
     (SELECT count(*) FROM meal_logs)      AS meal_logs,
     (SELECT count(*) FROM kb_chunks)      AS kb_chunks;
   ```
5. **Smoke** — point a local API at the restored DB and hit `/health` +
   `/api/v1/optimize/today` for a seeded user.
6. **Record** — date, backup id, target, and the row-count comparison in the
   incident log / this file's changelog.

## Notes
- `kb_chunks` uses `vector(768)` (pgvector) — ensure the extension exists on the
  target: `CREATE EXTENSION IF NOT EXISTS vector;` (also `pg_trgm`).
- Do the drill on a **non-production** target; never restore over prod.
