# Runbook: Incident Response

**When production is down or degraded.** Goal: restore service fast, then find
root cause.

## 1. Confirm & assess (first 5 min)
- Hit `https://api.messfit.app/health` — up? what version?
- Check **Sentry** (recent error spike?) and **Grafana → API Health (RED)**
  (error rate, p95, request rate by route).
- Scope it: whole API down, one endpoint, frontend only, or DB?

## 2. Triage by symptom
| Symptom | Likely cause | First action |
|---|---|---|
| 5xx across all routes | API process crashed / bad deploy | Roll back (see `deploy-rollback.md`) |
| 5xx on DB-backed routes only | DB unreachable / pool exhausted | Check Supabase status; restart API to reset pool |
| Slow p95, rising | Load spike / slow queries | See `scale-up.md`; check slow queries in Grafana |
| Auth 401s everywhere | JWKS/JWT secret/issuer misconfig | Verify Supabase keys + `SUPABASE_*` env |
| Optimizer/chat errors | Redis or LLM provider down | Check Upstash; check Gemini/Groq status |
| OCR stuck pending | Celery worker down | Restart worker; check Redis broker |

## 3. Mitigate
- **Bad deploy** → roll back to the last good release (`deploy-rollback.md`).
- **Dependency down** (Redis/LLM) → the optimizer cache and chatbot fall back
  where possible; otherwise post a status note and wait/upgrade.
- **DB overload** → reduce load (rate limits already cap writes), scale the DB
  tier, or shed traffic.

## 4. Communicate
- Post status to the team channel: what's affected, impact, ETA.
- For data-affecting incidents, note whether any user data was exposed (DPDP).

## 5. After
- Write a short post-mortem: timeline, root cause, fix, prevention.
- File follow-up issues (alerts, tests, guards) so it can't recur silently.

## Key dashboards & consoles
- Sentry (errors), Grafana (RED + business + AI/optimizer), Supabase (DB),
  Upstash (Redis), Vercel (frontend), Render/Railway (API + worker).
