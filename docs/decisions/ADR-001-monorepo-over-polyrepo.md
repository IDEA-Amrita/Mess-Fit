# ADR-001: Monorepo over polyrepo

| | |
|---|---|
| **Date** | 2026-05-15 |
| **Status** | Proposed |
| **Decider(s)** | @kavinesh, @teammate |
| **Related** | ADR-005, ADR-006 |

---

## Context

MessFit ships a Next.js web app, a FastAPI service, a Celery worker, and
shared TS/Python packages. The team is 2 people. We need to choose how
to organize the source: one repo with workspaces, or one repo per
deployable.

Forces:
- Small team, frequent cross-cutting changes (TS type ↔ Python schema)
- We're early — no SLA isolation needs, no separate release cadences
- CI cost is a real concern on free tiers

## Decision

Use a single GitHub repo with **pnpm workspaces** for the JS side and
**uv workspaces** for the Python side. Shared types live in
`packages/shared-types/`. CI runs lint + type-check + test on every PR
with path filters so each app only rebuilds when its files change.

## Consequences

### Positive
- Cross-stack changes ship in one PR
- Single CI config to maintain
- Shared tooling (prettier, ruff, pre-commit) configured once

### Negative
- CI for changes to one app still pays repo-clone cost
- Tooling needs path filters to avoid wasted builds

### Neutral
- Requires `pnpm`/`uv` over `npm`/`pip` to get workspaces

## Alternatives considered

### Alternative 1: Polyrepo (one repo per deployable)
**Pros:** Per-app ownership clean, independent CI/CD.
**Cons:** Cross-stack changes need coordinated PRs; shared types need to
be published as packages.
**Why rejected:** Overkill for 2 people; coordination cost > isolation benefit.

### Alternative 2: Git submodules
**Pros:** Some isolation, single root.
**Cons:** Submodule UX is notoriously painful.
**Why rejected:** Not worth the operational pain.

## Revisit when
- Team grows beyond 5 people
- One deployable needs a fundamentally different release cadence (e.g., mobile app store)
