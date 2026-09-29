"""Data contracts for the plate optimizer.

These are the *ports* of the optimizer's hexagonal design: plain, frozen
dataclasses with no dependency on SQLAlchemy, Redis, or FastAPI. The pure
solver (``solver.optimize``) consumes an :class:`OptimizationInput` and
returns an :class:`OptimizationOutput`; every adapter (DB read, cache,
Celery task, HTTP endpoint) is built *around* these types, never inside
the solver.

Keeping the core I/O-free is what makes the eval framework possible — 50
scenarios can call ``optimize`` directly with zero infrastructure, exactly
like ``profile.goal_engine`` is unit-tested today.

Nutrition convention
--------------------
All nutrition numbers on :class:`Dish` are **per one serving** (one unit of
``serving_unit`` ≈ ``serving_grams``), NOT per 100 g. A decision variable of
``portions = 2`` therefore contributes ``2 * dish.kcal`` kcal.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

# Canonical vocabularies — kept here so the solver, the eval, and the DB
# adapter all agree on the same strings.
MealType = Literal["breakfast", "lunch", "snack", "dinner"]
DietType = Literal["vegan", "veg", "egg", "non_veg"]

# Diet inclusion: which dish diet-classes a user on a given diet may eat.
# A user's diet is the *most permissive* set they accept.
DIET_ALLOWED: dict[str, set[str]] = {
    "vegan": {"vegan"},
    "veg": {"vegan", "veg"},
    "egg": {"vegan", "veg", "egg"},
    "non_veg": {"vegan", "veg", "egg", "non_veg"},
}


@dataclass(frozen=True)
class Dish:
    """A single dish as the optimizer sees it. Nutrition is per serving."""

    id: str
    name: str
    category: str
    diet_type: str  # vegan | veg | egg | non_veg — explicit, never inferred

    serving_unit: str  # katori | piece | glass | small_katori | spoon | ...
    serving_grams: float
    portion_icon: str

    kcal: float
    protein_g: float
    carbs_g: float
    fats_g: float
    fiber_g: float = 0.0
    sodium_mg: float = 0.0
    glycemic_index: int | None = None

    allergens: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()

    @property
    def is_integer_only(self) -> bool:
        """Whole-unit foods can't be eaten in fractional servings.

        A katori of sambar can be 1.5 katori; an idli or a glass of milk
        is eaten whole. We key this off the portion icon, which is the
        unit the user actually sees.
        """
        return self.portion_icon in {"piece", "glass"}


@dataclass(frozen=True)
class CanteenItem:
    """An item the user can buy from the canteen to fill a nutrition gap."""

    id: str
    name: str
    cost_inr: int
    kcal: float
    protein_g: float
    carbs_g: float
    fats_g: float
    diet_type: str  # explicit, like Dish.diet_type — never assumed vegetarian
    portion_icon: str = "piece"


@dataclass(frozen=True)
class OptimizationInput:
    """Everything the solver needs for one day's plate, fully resolved.

    ``menu`` is keyed by meal type; each dish appears under the meal(s) the
    mess serves it. ``skip_dish_ids`` are the user's per-day exclusions
    (the ``dish_exclusions`` table) plus anything already marked unavailable.
    """

    # Daily targets (from goal_engine.Targets)
    daily_kcal: float
    daily_protein_g: float
    daily_carbs_g: float
    daily_fats_g: float

    # User constraints
    diet_type: str
    allergies: tuple[str, ...]
    conditions: tuple[str, ...]
    goal: str  # gain | lose | maintain — used by the reasons engine

    # What's available
    menu: dict[str, list[Dish]]
    canteen_items: tuple[CanteenItem, ...] = ()
    canteen_budget_inr: int = 0
    skip_dish_ids: tuple[str, ...] = ()


@dataclass
class PlateItem:
    """One recommended dish at a chosen portion count, with its nutrition."""

    dish_id: str
    name: str
    portions: float
    serving_unit: str
    portion_icon: str
    grams: float
    kcal: float
    protein_g: float
    carbs_g: float
    fats_g: float
    reason: str = ""


@dataclass
class GapFill:
    """A canteen suggestion to close a remaining macro gap.

    Carries its own macro contribution so the output is self-contained — the
    UI and the eval add gap-fills into the day's totals without re-reading
    the canteen catalog.
    """

    item_id: str
    name: str
    portions: float
    cost_inr: int
    kcal: float
    protein_g: float
    carbs_g: float
    fats_g: float
    text: str


@dataclass
class OptimizationOutput:
    """The solved plate plus the numbers needed to explain it."""

    plan: dict[str, list[PlateItem]]
    daily_totals: dict[str, float]
    daily_targets: dict[str, float]
    gap_fills: list[GapFill] = field(default_factory=list)
    solver_status: str = ""
    solve_time_ms: int = 0
