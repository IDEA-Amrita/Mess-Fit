# Runbook: Rotate Secrets

**When:** suspected leak, staff offboarding, or routine (every 6–12 months).
Rotate one secret at a time and verify before moving on.

## Where secrets live
- **API** (`services/api/.env` / host env on Render/Railway): `DATABASE_URL`,
  `REDIS_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
  `GEMINI_API_KEY`, `GROQ_API_KEY`, `SENTRY_DSN`,
  `OTEL_EXPORTER_OTLP_HEADERS`.
- **Web** (Vercel env): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL`,
  `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (CI only).

## Procedure per secret
1. Generate the new value in the provider console.
2. Update the host env (Render/Railway for API, Vercel for web). Keep the old
   value valid until the new one is confirmed where the provider allows overlap.
3. Redeploy / restart so processes pick up the new env.
4. Verify (`/health`, a real authed request, an optimizer + chat call).
5. Revoke the old value in the provider.

## Provider notes
- **Supabase service-role key / JWT secret** — rotating the JWT signing key
  invalidates existing user sessions (users must re-login). Schedule off-peak.
- **Gemini / Groq** — create the new key, swap, then delete the old key.
- **Upstash Redis** — rotating resets the connection string; update `REDIS_URL`
  for both API and Celery worker.
- **Sentry auth token** — CI/source-map upload only; safe to rotate anytime.

## Never
- Never commit secrets. `.env` is git-ignored; use host env vars in prod.
- Never expose the service-role key or JWT secret to the client (web only gets
  `NEXT_PUBLIC_*`).
