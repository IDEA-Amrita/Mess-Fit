# ADR-005: uv over pip / poetry

| | |
|---|---|
| **Date** | 2026-05-15 |
| **Status** | Proposed |
| **Decider(s)** | @kavinesh, @teammate |
| **Related** | ADR-001 |

---

## Context

Python dependency management options: `pip + venv`, `poetry`, `pdm`,
`uv`. We need workspace support (Python monorepo: `services/`,
`workers/`, `packages/eval/`), reproducible installs, and fast CI.

## Decision

Use **uv** for Python dependency management and workspace orchestration.
`pyproject.toml` at the repo root declares `[tool.uv.workspace]`
members; each member has its own `pyproject.toml`.

## Consequences

### Positive
- Workspace support out of the box
- Order-of-magnitude faster than pip/poetry on cold installs (Rust core)
- Single binary, no shim layer (`pyenv-virtualenv` etc.)
- `uv.lock` is a single committed lockfile for the whole workspace

### Negative
- Newer tool, smaller community — fewer Stack Overflow answers
- Some tooling integrations (IDE auto-detection) still catching up

### Neutral
- Team needs `uv` installed; one-liner

## Alternatives considered

### Alternative 1: Poetry
**Pros:** Mature, well-known.
**Cons:** Workspace support is limited; install times are slow.
**Why rejected:** Workspace and speed regressions.

### Alternative 2: pip-tools + pip
**Pros:** Standard tooling.
**Cons:** No workspace concept; manual venv management per package.
**Why rejected:** Doesn't fit the monorepo shape.

## Revisit when
- A blocking bug in uv we can't work around
- Python packaging standards add native workspace support
