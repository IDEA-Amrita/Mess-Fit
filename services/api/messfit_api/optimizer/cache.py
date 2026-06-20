"""Redis cache adapter for the plate optimizer.

Cache key  : messfit:plate:v{SOLVER_VERSION}:{sha256 of canonical OptimizationInput}
Cache value: JSON-serialised OptimizationOutput
TTL        : 24 h (86 400 s)

The hash covers the full input — targets, constraints, every dish's
nutrition, canteen items, skip list — so a catalog change or different user
profile always misses the cache correctly.

Usage:
    from messfit_api.optimizer.cache import get_or_optimize

    output = get_or_optimize(inp, redis_client)

The caller (Celery task / HTTP endpoint) owns the Redis connection; this
module never opens one itself.
"""

from __future__ import annotations

import hashlib
import json
import structlog
from dataclasses import asdict
from typing import Any

import redis as _redis

from .contracts import (
    CanteenItem,
    Dish,
    GapFill,
    OptimizationInput,
    OptimizationOutput,
    PlateItem,
)
from .solver import SOLVER_VERSION, optimize

_TTL = 86_400        # 24 h in seconds
_KEY_PREFIX = f"messfit:plate:v{SOLVER_VERSION}:"

logger = structlog.get_logger(__name__)


# ── input hashing ──────────────────────────────────────────────────────


def _dish_dict(d: Dish) -> dict[str, Any]:
    return {
        "id": d.id,
        "category": d.category,
        "diet_type": d.diet_type,
        "serving_unit": d.serving_unit,
        "serving_grams": d.serving_grams,
        "portion_icon": d.portion_icon,
        "kcal": d.kcal,
        "protein_g": d.protein_g,
        "carbs_g": d.carbs_g,
        "fats_g": d.fats_g,
        "fiber_g": d.fiber_g,
        "sodium_mg": d.sodium_mg,
        "glycemic_index": d.glycemic_index,
        "allergens": sorted(d.allergens),
        "tags": sorted(d.tags),
    }


def _canteen_dict(c: CanteenItem) -> dict[str, Any]:
    return {
        "id": c.id,
        "cost_inr": c.cost_inr,
        "kcal": c.kcal,
        "protein_g": c.protein_g,
        "carbs_g": c.carbs_g,
        "fats_g": c.fats_g,
        "diet_type": c.diet_type,
        "portion_icon": c.portion_icon,
    }


def _inp_hash(inp: OptimizationInput) -> str:
    """Stable sha256 of the full input; sorted for determinism."""
    payload: dict[str, Any] = {
        "daily_kcal": inp.daily_kcal,
        "daily_protein_g": inp.daily_protein_g,
        "daily_carbs_g": inp.daily_carbs_g,
        "daily_fats_g": inp.daily_fats_g,
        "diet_type": inp.diet_type,
        "allergies": sorted(inp.allergies),
        "conditions": sorted(inp.conditions),
        "goal": inp.goal,
        "menu": {
            meal: [_dish_dict(d) for d in sorted(dishes, key=lambda d: d.id)]
            for meal, dishes in sorted(inp.menu.items())
        },
        "canteen_items": [
            _canteen_dict(c) for c in sorted(inp.canteen_items, key=lambda c: c.id)
        ],
        "canteen_budget_inr": inp.canteen_budget_inr,
        "skip_dish_ids": sorted(inp.skip_dish_ids),
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


# ── output serialization ───────────────────────────────────────────────


def _output_to_json(output: OptimizationOutput) -> str:
    data = {
        "plan": {
            meal: [asdict(item) for item in items]
            for meal, items in output.plan.items()
        },
        "daily_totals": output.daily_totals,
        "daily_targets": output.daily_targets,
        "gap_fills": [asdict(gf) for gf in output.gap_fills],
        "solver_status": output.solver_status,
        "solve_time_ms": output.solve_time_ms,
    }
    return json.dumps(data)


def _output_from_json(raw: str | bytes) -> OptimizationOutput:
    data = json.loads(raw)
    plan = {
        meal: [PlateItem(**item) for item in items]
        for meal, items in data["plan"].items()
    }
    gap_fills = [GapFill(**gf) for gf in data["gap_fills"]]
    return OptimizationOutput(
        plan=plan,
        daily_totals=data["daily_totals"],
        daily_targets=data["daily_targets"],
        gap_fills=gap_fills,
        solver_status=data["solver_status"],
        solve_time_ms=data["solve_time_ms"],
    )


# ── public API ─────────────────────────────────────────────────────────


def get_or_optimize(
    inp: OptimizationInput,
    redis_client: _redis.Redis,
) -> OptimizationOutput:
    """Return a cached plate if available; otherwise solve, cache, and return.

    The cache is an optimisation, never a dependency: on any Redis error
    (connection refused, bad credentials, timeout) we log a warning and fall
    back to an uncached solve so the user still gets a plate.
    """
    key = _KEY_PREFIX + _inp_hash(inp)
    try:
        cached = redis_client.get(key)
    except _redis.RedisError:
        logger.warning(
            "Redis GET failed — solving without cache", exc_info=True
        )
        return optimize(inp)
    if cached is not None:
        return _output_from_json(cached)  # type: ignore
    output = optimize(inp)
    try:
        redis_client.setex(key, _TTL, _output_to_json(output))
    except _redis.RedisError:
        logger.warning(
            "Redis SETEX failed — result not cached", exc_info=True
        )
    return output
