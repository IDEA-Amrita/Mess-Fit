# MessFit

Constraint-based plate optimizer for Indian hostel students. Pick what
to eat from what your mess actually serves — given your calorie / macro
targets, allergens, and what's on the menu today.

## Quick start

### Prerequisites

- Node 20 + pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
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

### Running locally (two terminals)

```bash
# Terminal 1 — backend on :8000
cd services/api
uv run uvicorn messfit_api.main:app --reload --port 8000

# Terminal 2 — frontend on :3000
cd apps/web
pnpm dev
```

Then open <http://localhost:3000>.

Health check: `curl http://localhost:8000/health` should return
`{"status":"ok","version":"0.1.0"}`.

## Repo layout

```
Mess-Fit/
├── apps/web/                 Next.js PWA (frontend)
├── services/api/             FastAPI app
│   └── infra/migrations/     Alembic migrations
├── workers/                  Celery workers (optimizer, OCR)
├── packages/                 Shared code (TS types, eval harness)
├── docs/
│   ├── 01-prd/               Product requirements
│   ├── 02-tdd/               Technical design + schema
│   └── decisions/            ADRs
└── docker-compose.yml        Local Postgres + Redis
```

## Docs

- [PRD](./docs/01-prd/) — what we're building and why
- [TDD](./docs/02-tdd/) — architecture, data model
- [Decisions (ADRs)](./docs/decisions/) — why we picked what we picked
- [Phase plan](../Mess%20Fit%20Projects%20Resources/messfit-docs/03-phases/) —
  shipping order (Phase 0 = setup, Phase 1 = goal engine, …)

## Workflow

- Branch: `feat/<desc>`, `fix/<desc>`, `docs/<desc>`, `chore/<desc>`
- PRs target `main`; squash- or rebase-merge
- Pre-commit hooks (ruff, prettier, trailing-whitespace) run locally
- CI must pass before merge (lint + type-check + test)
- One approval required; head branch auto-deleted on merge

## Tech

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js + Tailwind + shadcn/ui | PWA from day 1 ([ADR-004](./docs/decisions/ADR-004-pwa-over-react-native.md)) |
| Backend | FastAPI + SQLAlchemy + Alembic | Async-first; modular monolith ([ADR-007](./docs/decisions/ADR-007-modular-monolith.md)) |
| Auth | Supabase Auth | Don't roll your own ([ADR-003](./docs/decisions/ADR-003-supabase-auth.md)) |
| DB | Postgres (Supabase) + pgvector | Single store ([ADR-001](./docs/decisions/ADR-001-monorepo-over-polyrepo.md)) |
| Optimizer | PuLP / CBC | Linear MILP fits V1 ([ADR-002](./docs/decisions/ADR-002-pulp-over-cp-sat-for-v1.md)) |
| Package mgmt | uv (Python) + pnpm (JS) | Workspaces + speed ([ADR-005](./docs/decisions/ADR-005-uv-over-pip-poetry.md), [ADR-006](./docs/decisions/ADR-006-pnpm-over-npm-yarn.md)) |

## License

MIT — see [LICENSE](./LICENSE).
