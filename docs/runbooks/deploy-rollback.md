# Runbook: Deploy & Rollback

## Deploy
- **Frontend (Vercel):** auto-deploys on push to `main`. Preview deploys per PR.
- **API + worker (Render/Railway):** auto-deploys on push to `main`; runs
  `alembic upgrade head` on release (or run it manually — see below).
- Commits fast-forward to `main` linearly (no force pushes).

### Migrations
Run before/with the API release so the schema matches the code:
```bash
cd services/api && uv run alembic upgrade head
```
Migrations are forward-only in practice. Prefer **expand → migrate → contract**
(add columns/tables first, deploy code, drop old later) so a rollback of code
stays compatible with the new schema.

## Rollback (bad release)
1. **Frontend:** Vercel → Deployments → pick the last good deploy →
   **Promote to Production** (instant).
2. **API:** Render/Railway → Deploys → **Redeploy** the previous good image, or
   `git revert <bad-sha>` and push (auto-deploys the revert).
3. **Schema:** if the bad release added a migration, prefer a **forward fix**.
   Only `alembic downgrade -1` if the down migration is known-safe and no new
   data depends on the change.
4. Verify `/health` reports the expected version + a smoke request passes.

## Pre-deploy checklist
- [ ] CI green (ruff, mypy, pytest; tsc + next build).
- [ ] New migration has a tested `downgrade`.
- [ ] Env vars for any new settings are set on the host (see
      `rotate-secrets.md` for the list).
- [ ] Feature is behind a flag if risky.
