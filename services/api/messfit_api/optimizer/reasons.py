"""Reason engine: annotate each PlateItem with a human-readable explanation.

Pure function over the solver output — no I/O, no DB. Called once after the
solver returns; mutates PlateItem.reason and GapFill.text in-place.

Priority order within _reason():
  1. Condition-specific (diabetes GI, PCOS fibre/GI) — most specific, shown first
  2. Top protein source in the meal
  3. Goal × protein density (gain / lose / maintain)
  4. Diet-type protein note (vegan, egg category)
  5. Calorie role (calorie-dense for gain; low-kcal filler for lose)
  6. High-fibre satiety note
  7. Carbohydrate base note (rice / roti)
  8. Balanced fallback

16 distinct template paths → covers the ≥15 templates required by task 3.3.
"""

from __future__ import annotations

from .contracts import Dish, GapFill, OptimizationInput, OptimizationOutput, PlateItem

# ── tunables ────────────────────────────────────────────────────────────
_HIGH_GI = 70  # mirrors solver.HIGH_GI_THRESHOLD
_LOW_GI_TAG = "low_gi"
_HIGH_FIBER_TAG = "high_fiber"
_HIGH_PROTEIN_TAG = "high_protein"
_CALORIE_DENSE_KCAL = 150  # kcal/portion threshold for "calorie-dense" label
_LOW_KCAL_KCAL = 65  # kcal/portion threshold for "low-calorie filler" label
_TOP_PROTEIN_FRAC = 0.30  # share of meal protein to be "top source"

_GOAL_LABEL = {"gain": "lean gain", "lose": "fat loss", "maintain": "maintenance"}


# ── 16 template paths ───────────────────────────────────────────────────


def _reason(
    item: PlateItem,
    dish: Dish,
    inp: OptimizationInput,
    is_top_protein: bool,
) -> str:
    goal = _GOAL_LABEL.get(inp.goal, "your target")
    gi = dish.glycemic_index

    # 1a. Diabetes + high-GI cap
    if "diabetes" in inp.conditions and gi is not None and gi >= _HIGH_GI:
        return f"High-GI ({gi}) — capped to 1 serving per diabetes protocol"

    # 1b. Diabetes + low-GI preferred
    if "diabetes" in inp.conditions and _LOW_GI_TAG in dish.tags:
        gi_str = f" (GI {gi})" if gi is not None else ""
        return f"Low-GI{gi_str} — steady blood-sugar response for your diabetes"

    # 2a. PCOS + high-fibre + low-GI (double benefit)
    if "pcos" in inp.conditions and _HIGH_FIBER_TAG in dish.tags and _LOW_GI_TAG in dish.tags:
        return "High-fibre and low-GI — regulates insulin and keeps you full (PCOS protocol)"

    # 2b. PCOS + high-fibre alone
    if "pcos" in inp.conditions and _HIGH_FIBER_TAG in dish.tags:
        return f"High-fibre ({dish.fiber_g:.0f}g) — supports hormone balance on your PCOS plan"

    # 2c. PCOS + low-GI alone
    if "pcos" in inp.conditions and _LOW_GI_TAG in dish.tags:
        return "Low-GI — steady energy throughout the day (PCOS protocol)"

    # 3. Top protein source in this meal
    if is_top_protein:
        return f"Top protein source in this meal — {item.protein_g:.0f}g toward your {goal} goal"

    # 4a. High-protein + gain
    if _HIGH_PROTEIN_TAG in dish.tags and inp.goal == "gain":
        return "Protein-dense — builds toward your lean-gain target"

    # 4b. High-protein + lose
    if _HIGH_PROTEIN_TAG in dish.tags and inp.goal == "lose":
        return "High protein, lower kcal — maximises muscle retention on your deficit"

    # 4c. High-protein + maintain
    if _HIGH_PROTEIN_TAG in dish.tags:
        return f"Strong protein source for your {goal} goal"

    # 5a. Vegan/veg diet with meaningful per-serving protein
    if inp.diet_type in {"vegan", "veg"} and dish.protein_g >= 5.0:
        return "One of the stronger plant-protein sources in today's menu"

    # 5b. Egg/protein-category dish
    if dish.category == "protein":
        return "Complete amino acids — efficient protein for your daily target"

    # 6a. Calorie-dense per serving → helps gain
    if dish.kcal >= _CALORIE_DENSE_KCAL and inp.goal == "gain":
        return f"Calorie-dense — helps reach your {inp.daily_kcal:.0f} kcal gain budget"

    # 6b. Low-calorie per serving → filler for lose
    if dish.kcal <= _LOW_KCAL_KCAL and inp.goal == "lose":
        return "Low-calorie — nutrient-dense without straining your deficit"

    # 7. High-fibre satiety (generic, no condition)
    if _HIGH_FIBER_TAG in dish.tags:
        return "High-fibre — filling and supports digestive health"

    # 8. Carbohydrate base
    if dish.category in {"rice", "roti"}:
        return "Carbohydrate base — steady fuel for the day"

    # 9. Balanced fallback
    return (
        f"Balanced fit for your {inp.daily_kcal:.0f} kcal"
        f" · {inp.daily_protein_g:.0f}g protein target"
    )


def _gap_text(gf: GapFill, protein_gap: float) -> str:
    if protein_gap > 1:
        return (
            f"Add {gf.portions} {gf.name} from the canteen (₹{gf.cost_inr})"
            f" — closes a {protein_gap:.0f}g protein gap the mess menu can't fill alone."
        )
    return (
        f"Add {gf.portions} {gf.name} from the canteen (₹{gf.cost_inr})"
        f" for +{gf.protein_g:.0f}g protein."
    )


# ── public API ──────────────────────────────────────────────────────────


def annotate(
    output: OptimizationOutput,
    inp: OptimizationInput,
    dish_by_id: dict[str, Dish],
) -> None:
    """Fill PlateItem.reason and update GapFill.text in-place."""
    # Identify the dish with the highest protein contribution per meal.
    meal_top: dict[str, str] = {}
    for meal_type, items in output.plan.items():
        if not items:
            continue
        top = max(items, key=lambda i: i.protein_g)
        meal_total_p = sum(i.protein_g for i in items)
        if meal_total_p > 0 and top.protein_g / meal_total_p >= _TOP_PROTEIN_FRAC:
            meal_top[meal_type] = top.dish_id

    for meal_type, items in output.plan.items():
        for item in items:
            dish = dish_by_id.get(item.dish_id)
            if dish is None:
                item.reason = f"Chosen for your {_GOAL_LABEL.get(inp.goal, 'daily')} target"
                continue
            is_top = meal_top.get(meal_type) == item.dish_id
            item.reason = _reason(item, dish, inp, is_top)

    # Update gap-fill texts with remaining protein gap.
    plan_protein = sum(i.protein_g for items in output.plan.values() for i in items)
    gap = max(inp.daily_protein_g - plan_protein, 0.0)
    for gf in output.gap_fills:
        gf.text = _gap_text(gf, gap)
        gap = max(gap - gf.protein_g, 0.0)
