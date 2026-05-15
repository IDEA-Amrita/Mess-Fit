# ADR-003: Supabase Auth over rolling our own

| | |
|---|---|
| **Date** | 2026-05-15 |
| **Status** | Proposed |
| **Decider(s)** | @kavinesh, @teammate |
| **Related** | |

---

## Context

We need email/password signup, session management, password reset, and
JWT issuance. Rolling our own would burn 1-2 weeks and is the kind of
code most likely to ship a bug.

## Decision

Use **Supabase Auth** as the identity provider. Frontend uses
`@supabase/supabase-js` for signup/login and session storage. The FastAPI
backend verifies Supabase-issued HS256 JWTs using `SUPABASE_JWT_SECRET`
on protected routes (`messfit_api.auth.deps.get_current_user_id`).

## Consequences

### Positive
- Auth works on day 3 of Phase 0, not week 3
- Password reset, email verification, OAuth providers all "free"
- Supabase Postgres + Auth integrate cleanly (RLS via `auth.uid()`)

### Negative
- Vendor lock-in for the user table; migration would require user
  re-registration or token re-issuance
- Free-tier auth has rate limits we'll eventually hit

### Neutral
- The `users` table in our DB is a mirror keyed by Supabase UUID, not the source of truth

## Alternatives considered

### Alternative 1: Roll our own (FastAPI + passlib + python-jose)
**Pros:** No vendor; full control.
**Cons:** 1-2 weeks of work; password reset / verification flows are
classic security footguns.
**Why rejected:** Velocity cost too high for V1.

### Alternative 2: Clerk / Auth0
**Pros:** Polished UX; SSO.
**Cons:** Paid past tiny free tiers; doesn't co-locate with DB.
**Why rejected:** Cost + we lose the Supabase RLS integration.

## Revisit when
- Free-tier limits become a real constraint (e.g., > 50K MAU)
- We need an auth flow Supabase doesn't support
