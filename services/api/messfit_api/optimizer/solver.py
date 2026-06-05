"""Plate optimizer — MILP core (PuLP + CBC).

Pure function: no DB, no Redis, no HTTP. Given an :class:`OptimizationInput`
(targets + constraints + what's on the menu/canteen) it returns the plate
that best matches the user's macro targets.

Model
-----
Decision variables
    x[(dish_id, meal)]  = servings of a mess dish at a meal
                          (integer for whole-unit foods like idli/milk,
                           continuous for katori-style dishes)
    y[item_id]          = units of a canteen item bought (always integer)

Objective — minimise the *relative* distance from each macro target:

    Σ_m  W_m · |total_m − target_m| / target_m     (m = protein, kcal, carbs, fats)
       + W_cost · spend / budget

Normalising each deviation by its own target makes the four macros
comparable (a 200-kcal miss and a 20-g protein miss are otherwise on wildly
different scales). Weights then encode genuine priority — protein first.

Constraints
    * HARD calorie band: 0.9·target ≤ kcal ≤ 1.1·target  (energy is the
      safety boundary).
    * Protein is NOT hard-bounded — it's driven by the objective and topped
      up from the canteen. A protein-poor veg day yields the best plate plus
      an honest gap-fill, never an infeasible/empty plate.
    * Per-dish/day serving cap, unit-aware (a katori curry ≠ an idli).
    * Per-meal total servings cap.
    * Diabetes: high-GI dishes capped tighter.
    * Canteen spend ≤ budget.
"""

from __future__ import annotations

import time

import pulp

from .contracts import (
    DIET_ALLOWED,
    CanteenItem,
    Dish,
    GapFill,
    OptimizationInput,
    OptimizationOutput,
    PlateItem,
)

# ─── tunables ─────────────────────────────────────────────────────────

# Objective weights (priority of matching each target). Protein leads — it's
# the hardest macro to hit from an Indian veg mess and the one that protects
# body composition. kcal next (bounded hard too); carbs/fats equal. These are
# sane defaults; the nutritionist grading pass is what ultimately tunes them.
W_PROTEIN = 3.0
W_KCAL = 2.0
W_CARBS = 1.0
W_FATS = 1.0
W_COST = 0.3  # mild preference against overspending the canteen

# Hard calorie band around target.
KCAL_LOWER = 0.9
KCAL_UPPER = 1.1

# Per-dish, per-day serving caps keyed by the portion unit the user sees.
# A katori of curry and a single idli are different "1 portions".
PORTION_CAP_BY_ICON: dict[str, int] = {
    "piece": 4,  # idli, dosa, chapati — eaten several at a time
    "katori": 3,
    "small_katori": 3,
    "glass": 2,
    "thumb": 3,
    "spoon": 3,
}
DEFAULT_PORTION_CAP = 3

# Total servings allowed in a single meal (prevents absurd stuffing).
MAX_SERVINGS_PER_MEAL = 8

# Diabetes: glycemic index at/above this is treated as "high-GI".
HIGH_GI_THRESHOLD = 70
HIGH_GI_DIABETES_CAP = 1

# Per-item canteen purchase cap.
CANTEEN_ITEM_CAP = 3

_EPS = 1e-6


# ─── eligibility + caps ───────────────────────────────────────────────


def is_diet_compatible(dish: Dish, diet_type: str) -> bool:
    """True if the dish's diet class is allowed for the user's diet."""
    return dish.diet_type in DIET_ALLOWED.get(diet_type, {dish.diet_type})


def is_eligible(dish: Dish, inp: OptimizationInput) -> bool:
    """A dish can be served only if it clears every hard filter."""
    if dish.id in inp.skip_dish_ids:
        return False
    if any(a in dish.allergens for a in inp.allergies):
        return False
    if not is_diet_compatible(dish, inp.diet_type):
        return False
    return True


def portion_cap(dish: Dish, conditions: tuple[str, ...]) -> int:
    """Max servings/day for a dish, unit-aware and condition-aware."""
    cap = PORTION_CAP_BY_ICON.get(dish.portion_icon, DEFAULT_PORTION_CAP)
    if (
        "diabetes" in conditions
        and dish.glycemic_index is not None
        and dish.glycemic_index >= HIGH_GI_THRESHOLD
    ):
        cap = min(cap, HIGH_GI_DIABETES_CAP)
    return cap


# ─── solve ────────────────────────────────────────────────────────────


def optimize(inp: OptimizationInput) -> OptimizationOutput:
    """Solve one day's plate. See module docstring for the model."""
    t0 = time.perf_counter()
    prob = pulp.LpProblem("messfit_plate", pulp.LpMinimize)

    # Decision variables for mess dishes, keyed (dish_id, meal). We keep a
    # parallel map dish_id -> Dish for nutrition lookups.
    x: dict[tuple[str, str], pulp.LpVariable] = {}
    dish_by_id: dict[str, Dish] = {}
    meal_vars: dict[str, list[pulp.LpVariable]] = {}
    day_vars_by_dish: dict[str, list[pulp.LpVariable]] = {}

    for meal_type, dishes in inp.menu.items():
        meal_vars.setdefault(meal_type, [])
        for dish in dishes:
            if not is_eligible(dish, inp):
                continue
            dish_by_id[dish.id] = dish
            cap = portion_cap(dish, inp.conditions)
            var = pulp.LpVariable(
                f"x_{dish.id}_{meal_type}",
                lowBound=0,
                upBound=cap,
                cat="Integer" if dish.is_integer_only else "Continuous",
            )
            x[(dish.id, meal_type)] = var
            meal_vars[meal_type].append(var)
            day_vars_by_dish.setdefault(dish.id, []).append(var)

    # Canteen variables (integer units), only if there's a budget to spend.
    y: dict[str, pulp.LpVariable] = {}
    canteen_by_id: dict[str, CanteenItem] = {}
    if inp.canteen_budget_inr > 0:
        for item in inp.canteen_items:
            if item.diet_type not in DIET_ALLOWED.get(inp.diet_type, {item.diet_type}):
                continue
            canteen_by_id[item.id] = item
            y[item.id] = pulp.LpVariable(
                f"y_{item.id}", lowBound=0, upBound=CANTEEN_ITEM_CAP, cat="Integer"
            )

    # Linear macro totals across mess + canteen.
    def _macro(attr: str) -> pulp.LpAffineExpression:
        mess = pulp.lpSum(
            getattr(dish_by_id[did], attr) * var for (did, _m), var in x.items()
        )
        canteen = pulp.lpSum(
            getattr(canteen_by_id[iid], attr) * var for iid, var in y.items()
        )
        return mess + canteen

    total_k = _macro("kcal")
    total_p = _macro("protein_g")
    total_c = _macro("carbs_g")
    total_f = _macro("fats_g")
    spend = pulp.lpSum(canteen_by_id[iid].cost_inr * var for iid, var in y.items())

    # Deviation aux vars. We use addConstraint (not ``prob +=``) so this
    # nested closure doesn't rebind ``prob`` as a local (UnboundLocalError).
    def _abs_dev(name: str, expr: pulp.LpAffineExpression, target: float) -> pulp.LpVariable:
        """Symmetric |total - target| — penalises over- and under-shoot."""
        dev = pulp.LpVariable(name, lowBound=0)
        prob.addConstraint(dev >= expr - target, f"{name}_lo")
        prob.addConstraint(dev >= target - expr, f"{name}_hi")
        return dev

    def _shortfall(name: str, expr: pulp.LpAffineExpression, target: float) -> pulp.LpVariable:
        """One-sided max(target - total, 0) — penalises only falling short.

        Used for protein: hitting *at least* the target is the goal; exceeding
        it is fine (and on a cut we actively want every protein-efficient gram
        the calorie band allows), so overshoot must not be penalised.
        """
        dev = pulp.LpVariable(name, lowBound=0)
        prob.addConstraint(dev >= target - expr, f"{name}_short")
        return dev

    dev_p = _shortfall("dev_protein", total_p, inp.daily_protein_g)
    dev_k = _abs_dev("dev_kcal", total_k, inp.daily_kcal)
    dev_c = _abs_dev("dev_carbs", total_c, inp.daily_carbs_g)
    dev_f = _abs_dev("dev_fats", total_f, inp.daily_fats_g)

    # Objective: weighted relative deviations + a light spend penalty.
    def _rel(dev: pulp.LpVariable, target: float) -> pulp.LpAffineExpression:
        return dev / target if target > 0 else dev

    prob += (
        W_PROTEIN * _rel(dev_p, inp.daily_protein_g)
        + W_KCAL * _rel(dev_k, inp.daily_kcal)
        + W_CARBS * _rel(dev_c, inp.daily_carbs_g)
        + W_FATS * _rel(dev_f, inp.daily_fats_g)
        + (W_COST * spend / inp.canteen_budget_inr if inp.canteen_budget_inr > 0 else 0)
    )

    # ── hard constraints ──
    prob += total_k >= KCAL_LOWER * inp.daily_kcal
    prob += total_k <= KCAL_UPPER * inp.daily_kcal

    for did, vars_ in day_vars_by_dish.items():
        prob += pulp.lpSum(vars_) <= portion_cap(dish_by_id[did], inp.conditions)

    for meal_type, vars_ in meal_vars.items():
        if vars_:
            prob += pulp.lpSum(vars_) <= MAX_SERVINGS_PER_MEAL

    if y:
        prob += spend <= inp.canteen_budget_inr

    # ── solve ──
    solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=5)
    status = prob.solve(solver)
    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    return _build_output(
        x, y, dish_by_id, canteen_by_id, inp, status, elapsed_ms
    )


# ─── output assembly ──────────────────────────────────────────────────


def _build_output(
    x: dict[tuple[str, str], pulp.LpVariable],
    y: dict[str, pulp.LpVariable],
    dish_by_id: dict[str, Dish],
    canteen_by_id: dict[str, CanteenItem],
    inp: OptimizationInput,
    status: int,
    elapsed_ms: int,
) -> OptimizationOutput:
    plan: dict[str, list[PlateItem]] = {m: [] for m in inp.menu}

    for (did, meal), var in x.items():
        val = var.value() or 0.0
        if val <= _EPS:
            continue
        d = dish_by_id[did]
        plan[meal].append(
            PlateItem(
                dish_id=d.id,
                name=d.name,
                portions=round(val, 4),
                serving_unit=d.serving_unit,
                portion_icon=d.portion_icon,
                grams=round(d.serving_grams * val, 1),
                kcal=round(d.kcal * val, 1),
                protein_g=round(d.protein_g * val, 2),
                carbs_g=round(d.carbs_g * val, 2),
                fats_g=round(d.fats_g * val, 2),
            )
        )

    gap_fills: list[GapFill] = []
    for iid, var in y.items():
        units = int(round(var.value() or 0.0))
        if units <= 0:
            continue
        it = canteen_by_id[iid]
        gap_fills.append(
            GapFill(
                item_id=it.id,
                name=it.name,
                portions=units,
                cost_inr=it.cost_inr * units,
                kcal=round(it.kcal * units, 1),
                protein_g=round(it.protein_g * units, 2),
                carbs_g=round(it.carbs_g * units, 2),
                fats_g=round(it.fats_g * units, 2),
                text=(
                    f"Add {units} {it.name} from the canteen "
                    f"(₹{it.cost_inr * units}) for +{round(it.protein_g * units)}g protein."
                ),
            )
        )

    def _sum(field: str) -> float:
        plan_total = sum(getattr(i, field) for items in plan.values() for i in items)
        gf_total = sum(getattr(g, field) for g in gap_fills)
        return round(plan_total + gf_total, 1)

    daily_totals = {
        "kcal": _sum("kcal"),
        "protein_g": _sum("protein_g"),
        "carbs_g": _sum("carbs_g"),
        "fats_g": _sum("fats_g"),
    }
    daily_targets = {
        "kcal": inp.daily_kcal,
        "protein_g": inp.daily_protein_g,
        "carbs_g": inp.daily_carbs_g,
        "fats_g": inp.daily_fats_g,
    }

    return OptimizationOutput(
        plan=plan,
        daily_totals=daily_totals,
        daily_targets=daily_targets,
        gap_fills=gap_fills,
        solver_status=pulp.LpStatus[status],
        solve_time_ms=elapsed_ms,
    )
