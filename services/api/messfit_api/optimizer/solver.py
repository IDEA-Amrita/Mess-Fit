"""Plate optimizer — MILP core (PuLP + CBC).

NOT YET IMPLEMENTED. This stub exists so the eval framework (task 3.1) can
import and exercise the public contract *before* the solver is written —
that's the deliberate "eval before solver" discipline of Phase 3. Running
the eval now produces an all-red baseline; task 3.2 fills this in until the
scenarios go green.
"""

from __future__ import annotations

from .contracts import OptimizationInput, OptimizationOutput


def optimize(inp: OptimizationInput) -> OptimizationOutput:
    """Solve one day's plate. See task 3.2."""
    raise NotImplementedError(
        "Optimizer solver not implemented yet (Phase 3 task 3.2). "
        "The eval framework (task 3.1) is intentionally built first."
    )
