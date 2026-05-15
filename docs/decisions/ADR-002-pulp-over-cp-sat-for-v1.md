# ADR-002: PuLP over CP-SAT for V1 optimizer

| | |
|---|---|
| **Date** | 2026-05-15 |
| **Status** | Proposed |
| **Decider(s)** | @kavinesh, @teammate |
| **Related** | ADR-007 |

---

## Context

The plate-optimizer must pick a serving of mess items that meets
calorie/macro targets while respecting hard constraints (allergens,
availability, max servings). Two candidate solvers:

- **PuLP** (LP/MILP via CBC) — linear models, mature Python API
- **CP-SAT** (ortools) — constraint programming, handles nonlinear and
  combinatorial constraints natively

For V1 the constraints fit a MILP shape: linear macro sums, integer
serving counts, hard category caps.

## Decision

Use **PuLP with the bundled CBC solver** for the V1 optimizer. Move to
CP-SAT only if a future constraint (e.g., "no two dishes from the same
cuisine in a row") forces a non-linear formulation.

## Consequences

### Positive
- Simpler model: macros are linear in serving counts
- CBC ships with PuLP — no separate solver install
- Faster onboarding for contributors who know LP intuition

### Negative
- Nonlinear constraints will require either linearization or migration
- CBC is slower than commercial MILP solvers on hard instances

### Neutral
- Solver swap (PuLP → CP-SAT) is a contained change in `workers/optimizer/`

## Alternatives considered

### Alternative 1: CP-SAT (ortools)
**Pros:** Handles symbolic logic and combinatorial constraints natively.
**Cons:** Steeper learning curve; modeling API less obvious for newcomers.
**Why rejected:** V1 doesn't need its expressiveness; cost not justified yet.

### Alternative 2: Heuristic / greedy picker
**Pros:** Fastest to implement.
**Cons:** No optimality guarantees; hard to extend with new constraints.
**Why rejected:** Loses the core "constraint-based" pitch of the product.

## Revisit when
- A constraint we need can't be expressed linearly
- Optimizer p95 latency exceeds 500ms on real workloads
