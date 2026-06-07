"""Eval scenario loader.

Turns a scenario JSON file into a fully-resolved ``OptimizationInput`` the
pure solver can consume — the eval's *adapter* layer (the production code
will have a DB adapter that does the analogous job from SQL rows).

Design choices that keep the eval honest:

* **Targets come from the real ``goal_engine``**, not hand-typed into each
  scenario. A scenario describes a *user*; we run the exact same math
  production runs to derive their kcal/macro targets. If the goal engine
  changes, the scenarios move with it instead of going stale.
* **Dishes/canteen items come from a shared catalog** (``dish_catalog.json``)
  of real Amrita dishes, so nutrition is grounded and never duplicated.
* **Deterministic age→dob**: a scenario gives an integer age; we pin a fixed
  reference date so ``compute_targets`` is reproducible in CI.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

from messfit_api.optimizer.contracts import (
    CanteenItem,
    Dish,
    OptimizationInput,
)
from messfit_api.profile.goal_engine import compute_targets

_EVAL_DIR = Path(__file__).resolve().parent
_CATALOG_PATH = _EVAL_DIR / "dish_catalog.json"
_CANTEEN_PATH = _EVAL_DIR / "canteen_catalog.json"
SCENARIOS_DIR = _EVAL_DIR / "scenarios"

# Fixed "today" so age→dob→targets is fully deterministic across machines/CI.
REFERENCE_TODAY = date(2026, 1, 1)


@lru_cache(maxsize=1)
def load_catalog() -> dict[str, Dish]:
    """Load the shared dish catalog, keyed by dish id."""
    raw = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
    catalog: dict[str, Dish] = {}
    for d in raw:
        catalog[d["id"]] = Dish(
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
    return catalog


@lru_cache(maxsize=1)
def load_canteen() -> dict[str, CanteenItem]:
    """Load canteen items; nutrition is borrowed from the dish catalog."""
    catalog = load_catalog()
    raw = json.loads(_CANTEEN_PATH.read_text(encoding="utf-8"))
    items: dict[str, CanteenItem] = {}
    for c in raw:
        d = catalog[c["dish_id"]]
        items[d.id] = CanteenItem(
            id=d.id,
            name=d.name,
            cost_inr=int(c["cost_inr"]),
            kcal=d.kcal,
            protein_g=d.protein_g,
            carbs_g=d.carbs_g,
            fats_g=d.fats_g,
            diet_type=d.diet_type,
            portion_icon=d.portion_icon,
        )
    return items


def _age_to_dob(age: int) -> date:
    """Map an integer age to a deterministic dob against REFERENCE_TODAY."""
    return date(REFERENCE_TODAY.year - age, REFERENCE_TODAY.month, REFERENCE_TODAY.day)


@dataclass(frozen=True)
class LoadedScenario:
    """A scenario resolved into solver input + the targets it was built on."""

    id: str
    description: str
    input: OptimizationInput
    expected: dict[str, Any]
    # Targets surfaced for sanity-checks and default expected ranges.
    daily_kcal: float
    daily_protein_g: float
    daily_carbs_g: float
    daily_fats_g: float


def build_scenario(raw: dict[str, Any]) -> LoadedScenario:
    """Resolve one scenario dict into a :class:`LoadedScenario`."""
    catalog = load_catalog()
    canteen = load_canteen()
    user = raw["user"]

    targets = compute_targets(
        dob=_age_to_dob(int(user["age"])),
        sex=user["sex"],
        height_cm=float(user["height_cm"]),
        current_weight_kg=float(user["weight_kg"]),
        target_rate_kg_per_week=float(user.get("target_rate_kg_per_week", 0.0)),
        goal=user["goal"],
        activity_level=int(user["activity_level"]),
        conditions=list(user.get("conditions", [])),
        today=REFERENCE_TODAY,
    )

    menu: dict[str, list[Dish]] = {}
    for meal_type, dish_ids in raw["menu"].items():
        resolved: list[Dish] = []
        for did in dish_ids:
            if did not in catalog:
                raise KeyError(
                    f"Scenario {raw['id']!r}: menu dish id {did!r} not in catalog"
                )
            resolved.append(catalog[did])
        menu[meal_type] = resolved

    canteen_ids = raw.get("canteen", [])
    canteen_items = tuple(canteen[cid] for cid in canteen_ids)

    inp = OptimizationInput(
        daily_kcal=float(targets.daily_kcal),
        daily_protein_g=float(targets.daily_protein_g),
        daily_carbs_g=float(targets.daily_carbs_g),
        daily_fats_g=float(targets.daily_fats_g),
        diet_type=user["diet_type"],
        allergies=tuple(user.get("allergies", [])),
        conditions=tuple(user.get("conditions", [])),
        goal=user.get("goal", "maintain"),
        menu=menu,
        canteen_items=canteen_items,
        canteen_budget_inr=int(user.get("canteen_budget_inr", 0)),
        skip_dish_ids=tuple(raw.get("skip_dish_ids", [])),
    )

    return LoadedScenario(
        id=raw["id"],
        description=raw.get("description", ""),
        input=inp,
        expected=raw.get("expected_properties", {}),
        daily_kcal=float(targets.daily_kcal),
        daily_protein_g=float(targets.daily_protein_g),
        daily_carbs_g=float(targets.daily_carbs_g),
        daily_fats_g=float(targets.daily_fats_g),
    )


def load_scenario_file(path: Path) -> LoadedScenario:
    """Read and resolve a single scenario JSON file."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    return build_scenario(raw)


def all_scenario_paths() -> list[Path]:
    """Every scenario JSON file, sorted by name for stable test ids."""
    return sorted(SCENARIOS_DIR.glob("*.json"))
