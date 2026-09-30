# MessFit

Constraint-based plate optimizer + fitness companion for Indian hostel students.
Pick what to eat from **what your mess actually serves** — given your calorie /
macro targets, allergens, conditions, and today's menu — then log it, track
progress, train, and ask a grounded AI coach.

Built for Amrita Coimbatore hostelers, where you can't choose your ingredients —
so generic fitness apps don't fit.

## What's inside

| Area | What it does |
|---|---|
| **Goal engine** | Mifflin-St Jeor BMR → TDEE → calorie + macro targets from your profile, goal, and conditions |
| **Plate optimizer** | MILP solver (PuLP/CBC) picks portions from the live mess menu to hit your targets within allergen/diet/condition constraints — with one-line reasons |
| **Mess & menu** | Per-hostel mess menus; admin menu management; **menu-photo OCR** (upload a photo → parsed dishes via async worker) |
| **Workouts** | Hostel-friendly workout templates (bodyweight + gym), progression, exercise catalog |
| **Logging + progress** | Log meals/weight/workouts/mood; adherence, macro-hit rate, streaks, weight projection; charts |
| **AI coach** | RAG chatbot grounded in a curated KB (Gemini embeddings + pgvector), SSE streaming, medical-refusal + citation guardrails, semantic cache |
| **Learn** | 15 public, hostel-angled nutrition/fitness articles at `/learn`; chatbot citations deep-link here |
| **Hardening** | OpenTelemetry tracing, Grafana dashboards, Sentry (PII-scrubbed), per-route rate limits, k6 load tests, privacy/ToS, DPDP account deletion, ops runbooks |

Build status: **Phases 0–9 complete.** Next is the Amrita pilot (Phase 10).

## Quick start

### Prerequisites

- Node 24 LTS (pnpm 11 needs at least 22.13) + pnpm 11 (`corepack enable && corepack prepare pnpm@11 --activate`)
- Python 3.12 + [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Docker + Docker Compose

### First-time setup

```bash
git clone https://github.com/IDEA-Amrita/Mess-Fit.git
cd Mess-Fit

# JS + Python deps
pnpm install
cd services/api && uv sync && cd ../..

# Env files (fill in real secrets after copying)
cp services/api/.env.example services/api/.env
cp apps/web/.env.local.example apps/web/.env.local

# Local Postgres + Redis
docker compose up -d

# Run migrations
cd services/api && uv run alembic upgrade head && cd ../..
```

### Running locally

```bash
# Terminal 1 — backend on :8000
cd services/api
uv run uvicorn messfit_api.main:app --reload --port 8000

# Terminal 2 — frontend on :3000
cd apps/web
pnpm dev

# Terminal 3 (optional) — Celery worker for OCR + the account hard-delete sweep
cd services/api
uv run celery -A messfit_api.celery_app worker --beat --loglevel=info
```

Then open <http://localhost:3000>.

Health check: `curl http://localhost:8000/health` → `{"status":"ok","version":"0.1.0"}`.

### Seeding data

```bash
cd services/api
uv run python scripts/ingest_articles.py     # curated KB from /learn articles (chatbot)
# plus the mess/dish/workout seed scripts under scripts/ as needed
```

## Configuration

All secrets live in `.env` files (git-ignored); production uses host env vars.
See `services/api/.env.example` and `apps/web/.env.local.example` for the full
list. Notable groups:

- **Core:** `DATABASE_URL`, `REDIS_URL`, `SUPABASE_*`, `GEMINI_API_KEY`, `GROQ_API_KEY`
- **Observability (optional, no-op when empty):** `OTEL_EXPORTER_OTLP_ENDPOINT`,
  `OTEL_EXPORTER_OTLP_HEADERS`, `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
- **Rate limiting:** `RATE_LIMIT_ENABLED`, `RATE_LIMIT_STORAGE_URI` (set to the
  Redis URL in prod)

## Repo layout

```
Mess-Fit/
├── apps/web/                 Next.js 16 PWA (frontend)
│   └── src/content/articles/ 15 /learn markdown articles (also the chatbot KB)
├── services/api/             FastAPI app (modular monolith)
│   ├── messfit_api/          profile · mess · optimizer · workouts · tracking · chatbot · account · observability
│   ├── infra/migrations/     Alembic migrations (raw-SQL, RLS)
│   ├── scripts/              seed + ingest scripts
│   ├── eval/                 chatbot + optimizer eval harness
│   └── tests/                pytest suite (400+ tests, run as the RLS-restricted app role)
├── infra/
│   ├── grafana/dashboards/   importable Grafana dashboards (RED, business, AI/optimizer)
│   └── load-tests/           k6 scripts (optimizer, chat, smoke)
├── docs/
│   ├── 01-prd/  02-tdd/      product + technical design
│   ├── decisions/            ADRs
│   └── runbooks/             backup-restore · incident-response · rotate-secrets · deploy-rollback · scale-up
└── docker-compose.yml        Local Postgres + Redis
```

## Testing & quality

The backend suite writes and deletes rows, so it runs on its own throwaway
Postgres and **refuses to run against Supabase**. `scripts/test-db.ps1` starts
one in Docker (same image as CI), applies a small Supabase shim and migrates it.

```powershell
# Backend (needs Docker Desktop running)
cd services/api
./scripts/test-db.ps1              # add -Reset for a fresh database
$env:TEST_DATABASE_URL = "postgresql+asyncpg://messfit_app:messfit_app@127.0.0.1:55432/messfit_test"
$env:TEST_CELERY_DATABASE_URL = "postgresql+asyncpg://messfit_worker:messfit_worker@127.0.0.1:55432/messfit_test"
uv run ruff check .                # lint
uv run mypy messfit_api            # types
uv run pytest -q                   # full suite (RLS enforced, as in production)
uv run pytest eval/ -q             # optimizer evaluation

# Frontend
cd apps/web
pnpm exec tsc --noEmit             # types
pnpm exec eslint .                 # lint
pnpm build                         # production build
pnpm exec playwright test          # end-to-end (mocked backends)

# Load tests (against staging — see infra/load-tests/README.md)
k6 run --env API_URL=... --env AUTH_TOKEN=... infra/load-tests/optimizer.js
```

## Architecture

Modular monolith: one FastAPI app with per-domain packages, one async
SQLAlchemy engine, Postgres (Supabase) + pgvector + pg_trgm as the single store
(relational + embeddings), Redis for the optimizer cache / Celery broker, and
Celery workers for OCR + the daily account hard-delete sweep. The frontend is a
Next.js App Router PWA with a dark inline-styled theme, TanStack Query, and
Supabase Auth (JWT verified via JWKS). See [docs/02-tdd/](./docs/02-tdd/).

## Docs

- [PRD](./docs/01-prd/) — what we're building and why
- [TDD](./docs/02-tdd/) — architecture, data model
- [ADRs](./docs/decisions/) — why we picked what we picked
- [Runbooks](./docs/runbooks/) — backup/restore, incident response, secrets, deploy/rollback, scaling
- [Phase plan](../Mess%20Fit%20Projects%20Resources/messfit-docs/03-phases/) — shipping order (Phase 0 → 11)

## Workflow

- Branch: `feat/<desc>`, `fix/<desc>`, `docs/<desc>`, `chore/<desc>`
- PRs target `main`; linear history (no force-push to published commits)
- One commit per logical task; commits fast-forward to `main`
- CI must pass before merge (`.github/workflows/ci.yml`): ruff, mypy, migrations up/down, pytest, optimizer eval and dependency audit; tsc, eslint, build and Playwright

## Tech

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 + React 19 + Tailwind | PWA from day 1 ([ADR-004](./docs/decisions/ADR-004-pwa-over-react-native.md)) |
| Backend | FastAPI + SQLAlchemy 2 + Alembic | Async-first; modular monolith ([ADR-007](./docs/decisions/ADR-007-modular-monolith.md)) |
| Auth | Supabase Auth (JWKS / ES256) | Don't roll your own ([ADR-003](./docs/decisions/ADR-003-supabase-auth.md)) |
| DB | Postgres (Supabase) + pgvector | Single store ([ADR-001](./docs/decisions/ADR-001-monorepo-over-polyrepo.md)) |
| Optimizer | PuLP / CBC | Linear MILP fits V1 ([ADR-002](./docs/decisions/ADR-002-pulp-over-cp-sat-for-v1.md)) |
| LLM | Gemini (primary) + Groq (fallback) | Embeddings + grounded generation |
| Async | Celery + Redis (Upstash) | OCR + scheduled jobs |
| Observability | OpenTelemetry + Grafana + Sentry | Tracing, dashboards, error reporting |
| Package mgmt | uv (Python) + pnpm (JS) | Workspaces + speed ([ADR-005](./docs/decisions/ADR-005-uv-over-pip-poetry.md), [ADR-006](./docs/decisions/ADR-006-pnpm-over-npm-yarn.md)) |

## License

MIT — see [LICENSE](./LICENSE).
