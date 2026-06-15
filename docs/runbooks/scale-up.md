# Runbook: Scale Up

**When:** traffic approaches free-tier limits, or k6/Grafana show p95 climbing
or error rate rising under load.

## Read the signals first
- **Grafana → API Health (RED):** which routes are slow? p95 trend?
- **AI/Optimizer dashboard:** optimizer solve-time and chat generation latency.
- **Supabase:** connection count vs. limit; slow queries.
- **Upstash Redis:** command throughput / memory vs. plan.

## Levers (cheapest first)
1. **Rate limits** — already cap writes (`observability/ratelimit.py`). Tighten a
   hot route's limit if a few clients dominate.
2. **DB connection pool** — the API uses one async engine with `pool_pre_ping`.
   If connections are exhausted, lower per-process pool size × process count to
   stay under Supabase's limit, or use Supabase's connection pooler
   (`pgbouncer`, transaction mode) in `DATABASE_URL`.
3. **API instances** — scale horizontally on Render/Railway (more instances).
   Confirm rate-limit storage is **Redis** (`RATE_LIMIT_STORAGE_URI`) so limits
   are shared across instances, not per-process.
4. **Optimizer** — it's CPU-bound and cached in Redis. If solve time dominates,
   move it to a dedicated worker queue (`run_optimizer.delay`) instead of inline.
5. **Database tier** — upgrade Supabase (more CPU/RAM/connections + PITR).
6. **Redis tier** — upgrade Upstash if commands/memory are capped.
7. **LLM** — chat is provider-bound; raise quotas or rely on the Groq fallback.

## Capacity reference
- k6 target (Phase 9 gate): 100 VUs, p95 < 500ms, error rate < 1% on
  `/optimize/today`. Re-run `infra/load-tests/optimizer.js` against staging after
  any scaling change to confirm headroom.

## Don't
- Don't load-test production. Use staging (`infra/load-tests/README.md`).
