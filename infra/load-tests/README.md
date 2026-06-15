# k6 load tests (Phase 9, task 9.5)

Load profiles for the two hot, expensive paths plus a smoke check. These commit
the test definitions; **running them at 100 VUs is the operator's quality gate**
(error rate <1%, p95 <500ms).

| Script | What it does | Target |
|---|---|---|
| `smoke.js` | 1 VU: `/health` + `/api/v1/me` sanity | any env |
| `optimizer.js` | ramps 0→50→**100** VUs over 5 min on `POST /optimize/today`; thresholds `p95<500ms`, `errors<1%` | **staging** |
| `chat.js` | ramps to 40 VUs on the RAG chat path; tracks first-token latency | **staging** |

## Running

Install k6 (https://k6.io/docs/get-started/installation/), then:

```bash
# Sanity
k6 run --env API_URL=https://staging-api.messfit.app \
       --env AUTH_TOKEN=<supabase-jwt> infra/load-tests/smoke.js

# The PRD gate: 100 VUs for 5 minutes
k6 run --env API_URL=https://staging-api.messfit.app \
       --env AUTH_TOKEN=<supabase-jwt> infra/load-tests/optimizer.js
```

`AUTH_TOKEN` is a valid Supabase access token for a fully-onboarded test user
(profile + hostel + mess + a menu for today), otherwise `/optimize/today` returns
409 and the run measures error handling, not solve throughput.

## ⚠️ Run against staging, not production

The optimizer is CPU-heavy and `/optimize/today` reads the menu on every call.
Pointing 100 VUs at the production free-tier DB will exhaust connections. Use a
staging API + staging DB. Tune `uvicorn` workers, the SQLAlchemy pool, and the
Redis pool until the thresholds pass; record the result in the PR / runbook.
