"""Property-based eval runner for the plate optimizer.

For every scenario in ``scenarios/*.json`` we run the real ``optimize`` core
and assert a set of *properties* the plan must hold — not exact plates
(there are many good plates), but invariants a nutritionist-safe plan can
never violate:

  * stays inside the calorie band the goal engine set,
  * meets the protein floor,
  * never serves a dish the user is allergic to,
  * never serves a dish outside the user's diet,
  * honours the user's per-day skips,
  * respects portion caps (≤2× any dish/day, ≤ N portions/meal),
  * stays within the canteen budget.

This is the mechanical-correctness layer. The *qualitative* layer — "would
a nutritionist actually prescribe this?" — is the manual grading pass
described in the phase doc; that runs on the same scenario outputs.

While the solver is unimplemented (task 3.2 pending) each scenario SKIPS
with a clear reason instead of erroring — the deliberate "eval before
solver" baseline. The moment ``optimize`` is real, these become hard
assertions with nothing else to change.
"""

from __future__ import annotations

import pytest

from messfit_api.optimizer import optimize
from messfit_api.optimizer.contracts import DIET_ALLOWED
from messfit_api.optimizer.solver import MAX_SERVINGS_PER_MEAL, portion_cap

from .loader import LoadedScenario, all_scenario_paths, load_catalog, load_scenario_file

# Tolerance band around the goal-engine kcal target. Mirrors the solver's
# own hard constraint (0.9–1.1×) so the eval verifies the solver respects
# the energy bounds it was given.
KCAL_BAND = (0.9, 1.1)
# Default protein floor when a scenario doesn't override it.
PROTEIN_FLOOR_FRAC = 0.85

_SCENARIO_PATHS = all_scenario_paths()


@pytest.fixture(params=_SCENARIO_PATHS, ids=[p.stem for p in _SCENARIO_PATHS])
def scenario(request) -> LoadedScenario:
    return load_scenario_file(request.param)


@pytest.fixture
def result(scenario: LoadedScenario):
    """Run the solver, or skip cleanly until it exists (task 3.2)."""
    try:
        return optimize(scenario.input)
    except NotImplementedError as exc:  # pragma: no cover - removed once 3.2 lands
        pytest.skip(f"optimizer solver not implemented yet: {exc}")


# ─── helpers ──────────────────────────────────────────────────────────


def _all_items(plan):
    for items in plan.values():
        yield from items


def _totals(plan) -> dict[str, float]:
    return {
        "kcal": sum(i.kcal for i in _all_items(plan)),
        "protein_g": sum(i.protein_g for i in _all_items(plan)),
        "carbs_g": sum(i.carbs_g for i in _all_items(plan)),
        "fats_g": sum(i.fats_g for i in _all_items(plan)),
    }


# ─── property assertions ──────────────────────────────────────────────


def test_feasible(scenario: LoadedScenario, result):
    if scenario.expected.get("feasible", True):
        assert result.solver_status.lower() in {"optimal", "feasible"}, (
            f"{scenario.id}: solver returned status {result.solver_status!r}"
        )


def test_kcal_within_band(scenario: LoadedScenario, result):
    lo, hi = scenario.expected.get(
        "kcal_within_range",
        [KCAL_BAND[0] * scenario.daily_kcal, KCAL_BAND[1] * scenario.daily_kcal],
    )
    # Canteen gap-fills count toward energy — the user eats them too, and the
    # solver's hard band is enforced over mess + canteen combined.
    total = _totals(result.plan)["kcal"]
    total += sum(getattr(g, "kcal", 0.0) for g in result.gap_fills)
    assert lo <= total <= hi, f"{scenario.id}: kcal {total:.0f} not in [{lo:.0f},{hi:.0f}]"


def test_protein_floor(scenario: LoadedScenario, result):
    floor = scenario.expected.get("protein_min_g", PROTEIN_FLOOR_FRAC * scenario.daily_protein_g)
    # Canteen gap-fills count toward protein — they're part of the day's intake.
    total = _totals(result.plan)["protein_g"]
    total += sum(getattr(g, "protein_g", 0.0) for g in result.gap_fills)
    assert total >= floor, f"{scenario.id}: protein {total:.0f}g below floor {floor:.0f}g"


def test_allergens_excluded(scenario: LoadedScenario, result):
    catalog = load_catalog()
    banned = set(scenario.input.allergies) | set(
        scenario.expected.get("must_exclude_allergens", [])
    )
    for item in _all_items(result.plan):
        dish = catalog[item.dish_id]
        bad = banned.intersection(dish.allergens)
        assert not bad, f"{scenario.id}: planned {item.dish_id} carries banned allergen(s) {bad}"


def test_diet_respected(scenario: LoadedScenario, result):
    if not scenario.expected.get("diet_respected", True):
        return
    catalog = load_catalog()
    allowed = DIET_ALLOWED[scenario.input.diet_type]
    for item in _all_items(result.plan):
        dish = catalog[item.dish_id]
        assert dish.diet_type in allowed, (
            f"{scenario.id}: {item.dish_id} is {dish.diet_type}, "
            f"not allowed for diet {scenario.input.diet_type!r}"
        )


def test_excluded_dishes_absent(scenario: LoadedScenario, result):
    must_exclude = set(scenario.expected.get("must_exclude_dish_ids", [])) | set(
        scenario.input.skip_dish_ids
    )
    planned = {i.dish_id for i in _all_items(result.plan)}
    leaked = must_exclude & planned
    assert not leaked, f"{scenario.id}: plan contains excluded dishes {leaked}"


def test_respects_portion_caps(scenario: LoadedScenario, result):
    """No dish exceeds its unit-aware per-day serving cap.

    Replaces the old blunt "≤2× any dish" rule: a single idli (piece) and a
    katori of curry are different "1 portions", so the cap is unit-aware and
    comes straight from the solver (single source of truth).
    """
    if not scenario.expected.get("respects_portion_caps", True):
        return
    catalog = load_catalog()
    per_dish: dict[str, float] = {}
    for item in _all_items(result.plan):
        per_dish[item.dish_id] = per_dish.get(item.dish_id, 0.0) + item.portions
    for dish_id, portions in per_dish.items():
        cap = portion_cap(catalog[dish_id], scenario.input.conditions)
        assert portions <= cap + 1e-6, (
            f"{scenario.id}: {dish_id} served {portions} portions (cap {cap})"
        )


def test_max_portions_per_meal(scenario: LoadedScenario, result):
    # Scenario may tighten the cap; otherwise the solver's own limit applies.
    cap = scenario.expected.get("max_portions_per_meal", MAX_SERVINGS_PER_MEAL)
    for meal_type, items in result.plan.items():
        total = sum(i.portions for i in items)
        assert total <= cap + 1e-6, f"{scenario.id}: {meal_type} has {total} portions (cap {cap})"


def test_canteen_budget_respected(scenario: LoadedScenario, result):
    spent = sum(getattr(g, "cost_inr", 0) for g in result.gap_fills)
    assert spent <= scenario.input.canteen_budget_inr, (
        f"{scenario.id}: canteen spend ₹{spent} exceeds budget ₹{scenario.input.canteen_budget_inr}"
    )


def test_reasons_populated(scenario: LoadedScenario, result):
    """Every plate item must carry a non-empty reason string."""
    for meal_type, items in result.plan.items():
        for item in items:
            assert item.reason, f"{scenario.id}: {item.name} at {meal_type} has no reason"
