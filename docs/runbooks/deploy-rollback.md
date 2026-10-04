# Runbook: Deploy & Rollback

## Deploy
- **Frontend (Vercel):** auto-deploys on push to `main`. Preview deploys per PR.
- **API + worker (Render/Railway):** auto-deploys on push to `main`; runs
  `alembic upgrade head` on release (or run it manually — see below).
- Commits fast-forward to `main` linearly (no force pushes).

### The backend image
One image, built from the repository root by `services/api/Dockerfile`, runs
every backend process. The container's first argument picks the role
(`services/api/deploy/entrypoint.sh`):

| Service on the host | Type | Command | Notes |
|---|---|---|---|
| `messfit-api` | web service | `api` | Health check path `/health`. Honours `PORT` and `WEB_CONCURRENCY`. |
| `messfit-worker` | background worker | `worker` | Menu OCR and other jobs. Scale horizontally. |
| `messfit-beat` | background worker | `beat` | The schedule. **Exactly one instance**, or jobs run twice. |
| release step | pre-deploy command | `migrate` | Runs `alembic upgrade head` before new code takes traffic. |

All three services share the API's environment (see
`services/api/.env.example`). The app's `DATABASE_URL` is the
least-privilege `messfit_app` role (the worker and beat may use
`messfit_worker`); set `MIGRATION_DATABASE_URL` to the schema owner
(`postgres`) so only the release step can change the schema.

Build and run it locally:
```bash
docker build -f services/api/Dockerfile -t messfit-api .
docker compose --profile app up -d     # API, worker and beat from the image
```
CI builds the image on every pull request, checks it starts healthy as a
non-root user, and fails on any fixable HIGH or CRITICAL vulnerability
(Trivy).

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
- [ ] CI green: API (ruff, format, mypy, migrations, pytest, eval, audit),
      image (build, smoke, scan) and web (tsc, eslint, build, e2e, audit).
- [ ] New migration has a tested `downgrade`.
- [ ] Env vars for any new settings are set on the host (see
      `rotate-secrets.md` for the list).
- [ ] Feature is behind a flag if risky.
