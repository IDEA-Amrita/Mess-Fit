# ADR-006: pnpm over npm / yarn

| | |
|---|---|
| **Date** | 2026-05-15 |
| **Status** | Proposed |
| **Decider(s)** | @kavinesh, @teammate |
| **Related** | ADR-001 |

---

## Context

The monorepo's JS side has `apps/web` (Next.js) and `packages/*` (shared
types and utilities). We need workspace support, fast installs, and a
single lockfile.

## Decision

Use **pnpm** with `pnpm-workspace.yaml` declaring `apps/*` and
`packages/*` as workspace roots. Lockfile is `pnpm-lock.yaml`.

## Consequences

### Positive
- True workspace support; strict by default (no phantom deps)
- Content-addressed store — disk + install speed wins on cold setups
- Lockfile is deterministic across OSes (npm's has had drift issues)

### Negative
- A few packages with broken peer deps need explicit `pnpm.overrides`
- Slightly different CLI surface vs. `npm`

### Neutral
- Team needs `pnpm` installed; one-liner

## Alternatives considered

### Alternative 1: npm workspaces
**Pros:** Built-in to Node; no extra install.
**Cons:** Slower; less strict; phantom-dep bugs.
**Why rejected:** Strictness and speed wins of pnpm matter for our setup.

### Alternative 2: Yarn (Berry / PnP)
**Pros:** PnP eliminates `node_modules`.
**Cons:** PnP has long-standing tooling-compat issues, esp. with Next.js.
**Why rejected:** Compat risk outweighs PnP benefits.

## Revisit when
- pnpm breaks Next.js or a key tool in a way we can't work around
- npm/yarn shop a feature that materially changes the comparison
