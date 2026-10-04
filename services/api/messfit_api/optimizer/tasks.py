"""Celery task: run the plate optimizer.

V1 design: the task is wired up and serialisation-tested now so that the HTTP
endpoint (task 3.6) can call it with .delay() from day one, and switching from
an in-process call to a real async worker in V2 is a config-only change.

Serialisation boundary
    Celery's JSON serialiser can't carry Python dataclasses directly.
    ``inp_to_dict`` / ``_inp_from_dict`` convert OptimizationInput to/from a
    plain JSON-safe dict, and ``output_to_dict`` converts OptimizationOutput
    back for the result backend.  Both directions are round-trip tested in
    tests/optimizer/test_tasks.py.

Calling the task from the endpoint (task 3.6)
    from messfit_api.optimizer.tasks import run_optimizer, inp_to_dict, output_from_dict

    # V1 — synchronous inline call (no broker needed):
    result_dict = run_optimizer.apply(args=[inp_to_dict(inp)]).get()
    output = output_from_dict(result_dict)

    # V2 — async, returns immediately with a task ID for polling:
    async_result = run_optimizer.delay(inp_to_dict(inp))
"""

from __future__ import annotations

import dataclasses
from typing import Any

import redis as _redis

from ..celery_app import celery_app
from ..config import settings
from ..observability.setup import get_tracer
from .cache import get_or_optimize
from .contracts import (
    CanteenItem,
    Dish,
    GapFill,
    OptimizationInput,
    OptimizationOutput,
    PlateItem,
)


# ── Redis client (lazy singleton) ──────────────────────────────────────

_redis_client: _redis.Redis | None = None


def _get_redis() -> _redis.Redis:
    """Return the module-level Redis client, creating it on first call."""
    global _redis_client
    if _redis_client is None:
        _redis_client = _redis.from_url(settings.redis_url, decode_responses=False)
    return _redis_client


# ── input serialisation ────────────────────────────────────────────────


def _dish_from_dict(d: dict[str, Any]) -> Dish:
    return Dish(
        id=d["id"],
        name=d["name"],
        category=d["category"],
        diet_type=d["diet_type"],
        serving_unit=d["serving_unit"],
        serving_grams=float(d["serving_grams"]),
        portion_icon=d["portion_icon"],
        kcal=float(d["kcal"]),
        protein_g=float(d["protein_g"]),
        carbs_g=float(d["carbs_g"]),
        fats_g=float(d["fats_g"]),
        fiber_g=float(d.get("fiber_g", 0.0)),
        sodium_mg=float(d.get("sodium_mg", 0.0)),
        glycemic_index=d.get("glycemic_index"),
        allergens=tuple(d.get("allergens", [])),
        tags=tuple(d.get("tags", [])),
    )


def _canteen_from_dict(c: dict[str, Any]) -> CanteenItem:
    return CanteenItem(
        id=c["id"],
        name=c["name"],
        cost_inr=int(c["cost_inr"]),
        kcal=float(c["kcal"]),
        protein_g=float(c["protein_g"]),
        carbs_g=float(c["carbs_g"]),
        fats_g=float(c["fats_g"]),
        diet_type=c["diet_type"],
        portion_icon=c.get("portion_icon", "piece"),
    )


def inp_to_dict(inp: OptimizationInput) -> dict[str, Any]:
    """Serialise an OptimizationInput to a JSON-safe dict for Celery args."""
    return {
        "daily_kcal": inp.daily_kcal,
        "daily_protein_g": inp.daily_protein_g,
        "daily_carbs_g": inp.daily_carbs_g,
        "daily_fats_g": inp.daily_fats_g,
        "diet_type": inp.diet_type,
        "allergies": list(inp.allergies),
        "conditions": list(inp.conditions),
        "goal": inp.goal,
        "menu": {
            meal: [dataclasses.asdict(d) for d in dishes] for meal, dishes in inp.menu.items()
        },
        "canteen_items": [dataclasses.asdict(c) for c in inp.canteen_items],
        "canteen_budget_inr": inp.canteen_budget_inr,
        "skip_dish_ids": list(inp.skip_dish_ids),
    }


def _inp_from_dict(data: dict[str, Any]) -> OptimizationInput:
    return OptimizationInput(
        daily_kcal=float(data["daily_kcal"]),
        daily_protein_g=float(data["daily_protein_g"]),
        daily_carbs_g=float(data["daily_carbs_g"]),
        daily_fats_g=float(data["daily_fats_g"]),
        diet_type=data["diet_type"],
        allergies=tuple(data["allergies"]),
        conditions=tuple(data["conditions"]),
        goal=data["goal"],
        menu={meal: [_dish_from_dict(d) for d in dishes] for meal, dishes in data["menu"].items()},
        canteen_items=tuple(_canteen_from_dict(c) for c in data["canteen_items"]),
        canteen_budget_inr=int(data["canteen_budget_inr"]),
        skip_dish_ids=tuple(data["skip_dish_ids"]),
    )


# ── output serialisation ───────────────────────────────────────────────


def output_to_dict(output: OptimizationOutput) -> dict[str, Any]:
    """Serialise an OptimizationOutput to a JSON-safe dict (Celery result)."""
    return {
        "plan": {
            meal: [dataclasses.asdict(item) for item in items]
            for meal, items in output.plan.items()
        },
        "daily_totals": output.daily_totals,
        "daily_targets": output.daily_targets,
        "gap_fills": [dataclasses.asdict(gf) for gf in output.gap_fills],
        "solver_status": output.solver_status,
        "solve_time_ms": output.solve_time_ms,
    }


def output_from_dict(data: dict[str, Any]) -> OptimizationOutput:
    """Reconstruct an OptimizationOutput from a Celery result dict."""
    return OptimizationOutput(
        plan={meal: [PlateItem(**item) for item in items] for meal, items in data["plan"].items()},
        daily_totals=data["daily_totals"],
        daily_targets=data["daily_targets"],
        gap_fills=[GapFill(**gf) for gf in data["gap_fills"]],
        solver_status=data["solver_status"],
        solve_time_ms=data["solve_time_ms"],
    )


# ── Celery task ────────────────────────────────────────────────────────


@celery_app.task(name="messfit.optimizer.run")
def run_optimizer(inp_payload: dict[str, Any]) -> dict[str, Any]:
    """Deserialise the input, run the cached optimizer, return a result dict.

    The Redis client is obtained from the module-level singleton so it can be
    monkeypatched in unit tests without a real Redis connection.
    """
    inp = _inp_from_dict(inp_payload)
    dish_count = sum(len(dishes) for dishes in inp.menu.values())
    with get_tracer().start_as_current_span("optimizer.solve") as span:
        span.set_attribute("optimizer.dish_count", dish_count)
        output = get_or_optimize(inp, _get_redis())
        span.set_attribute("optimizer.solver_status", output.solver_status)
        span.set_attribute("optimizer.solve_time_ms", output.solve_time_ms)
    return output_to_dict(output)
