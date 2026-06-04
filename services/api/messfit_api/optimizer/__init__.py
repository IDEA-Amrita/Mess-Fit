"""Plate optimizer package (Phase 3).

Public surface:
    optimize(inp: OptimizationInput) -> OptimizationOutput   # the pure core

Everything else (DB adapter, Redis cache, Celery task, HTTP endpoint) wraps
this pure function. See ``contracts`` for the data types.
"""

from __future__ import annotations

from .contracts import (
    CanteenItem,
    Dish,
    GapFill,
    OptimizationInput,
    OptimizationOutput,
    PlateItem,
)
from .solver import optimize

__all__ = [
    "optimize",
    "Dish",
    "CanteenItem",
    "OptimizationInput",
    "OptimizationOutput",
    "PlateItem",
    "GapFill",
]
