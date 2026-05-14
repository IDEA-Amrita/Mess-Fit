# ADR-007: Modular monolith over microservices

| | |
|---|---|
| **Date** | 2026-05-15 |
| **Status** | Proposed |
| **Decider(s)** | @kavinesh, @teammate |
| **Related** | ADR-001 |

---

## Context

We have multiple logical concerns: API, optimizer, OCR, LLM chat. The
common temptation at this point is to ship them as separate services
("microservices"). We're 2 people, pre-PMF, pre-load.

## Decision

Build a **modular monolith**: one FastAPI deployable (`services/api`)
exposes all routes; heavy/async work (optimization, OCR jobs) runs in
Celery workers (`workers/*`) sharing the same Python package.
Internal module boundaries are enforced via package structure and
import lint rules, not network calls.

## Consequences

### Positive
- One deploy pipeline, one observability stack, one set of secrets
- Refactors across modules don't need cross-service coordination
- Local dev is `docker compose up` — no service mesh, no DNS games

### Negative
- A module that genuinely needs independent scaling can't get it without
  carving out a service
- Without discipline, modules creep into each other's internals

### Neutral
- The boundary between API and worker is real (Celery) — that one
  cross-process boundary stays as it is

## Alternatives considered

### Alternative 1: Microservices from day 1
**Pros:** Future-proofed for scale.
**Cons:** Massive operational tax pre-PMF; network failures + tracing
overhead for no current benefit.
**Why rejected:** Premature optimization at 2 people / 0 users.

### Alternative 2: Single process, no workers
**Pros:** Even simpler.
**Cons:** Optimizer runs are CPU-heavy; blocking the API event loop is
unacceptable.
**Why rejected:** Workers are non-negotiable for the workload shape.

## Revisit when
- A module's scaling profile diverges sharply (e.g., LLM chat needs GPU)
- A team subgroup needs to deploy independently
