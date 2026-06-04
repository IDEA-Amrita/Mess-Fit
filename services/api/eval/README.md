# Optimizer Eval Suite (Phase 3, task 3.1)

**Built before the solver, on purpose.** The #1 rule of Phase 3 is: do not
tune the optimizer without a way to grade it. This suite is that grader.

It runs the *pure* optimizer core (`messfit_api.optimizer.optimize`) against
hand-crafted scenarios and asserts **properties** a safe plan must always
hold — not exact plates, since many plates are equally good.

```
eval/
├── dish_catalog.json      # real Amrita dishes + explicit diet_type + nutrition
├── canteen_catalog.json   # canteen-buyable items (nutrition borrowed from catalog) + ₹ cost
├── loader.py              # scenario JSON -> OptimizationInput (targets via real goal_engine)
├── test_optimizer.py      # property-based parametrized runner
├── scenarios/*.json       # the graded scenarios
└── README.md
```

## Run it

```bash
# from services/api/
uv run pytest eval/ -q            # full suite
uv run pytest eval/ -k pcos       # one scenario family
uv run pytest eval/ -rs           # show skip/fail reasons
```

The eval is **not** part of the default `tests/` suite (kept out of
`testpaths`). Run it explicitly — it grades the optimizer and is allowed to
be slower and to fail loudly when a plan regresses.

> Until the solver lands (task 3.2) every scenario **skips** with
> "solver not implemented yet" — the deliberate red baseline. Once
> `optimize` is real the skips turn into hard assertions automatically.

## Scenario schema

```jsonc
{
  "id": "gain_male_egg_typical",          // unique; also the pytest id
  "description": "...",                    // human context; shown in grading PDF
  "user": {
    "sex": "male", "age": 19,
    "height_cm": 175, "weight_kg": 56,
    "goal": "gain",                        // gain | lose | maintain
    "target_rate_kg_per_week": 0.25,
    "activity_level": 3,                   // 1..5
    "diet_type": "egg",                    // vegan | veg | egg | non_veg
    "allergies": ["lactose"],              // dish allergens to exclude
    "conditions": ["pcos"],                // diabetes | pcos | ...
    "canteen_budget_inr": 40
  },
  "menu": {                                // dish ids from dish_catalog.json
    "breakfast": ["idly", "sambar", "..."],
    "lunch": ["..."], "snack": ["..."], "dinner": ["..."]
  },
  "canteen": ["boiled_egg", "milk"],       // ids from canteen_catalog.json
  "skip_dish_ids": ["medu_vada"],          // the dish_exclusions flow
  "expected_properties": {
    "kcal_within_range": [2400, 2700],     // optional; default 0.9–1.1 × goal-engine target
    "protein_min_g": 80,                   // optional; default 0.85 × target
    "must_exclude_allergens": ["lactose"],
    "must_exclude_dish_ids": ["milk"],
    "max_portions_per_meal": 6,
    "no_dish_more_than_2x": true,
    "diet_respected": true,
    "feasible": true
  }
}
```

**Targets are never hand-typed.** A scenario describes a *user*; the loader
runs the same `goal_engine.compute_targets` production uses to derive their
kcal/macros. Change the goal engine and the scenarios move with it.

## Hard vs soft constraints (design decision)

The goal engine prescribes aggressive protein for fat-loss (2.0–2.1 g/kg). A
vegetarian mess on a calorie *deficit* often cannot deliver that from food
alone. So the optimizer treats:

- **Calorie band — HARD** (0.9–1.1 × target). Energy is the safety boundary.
- **Protein floor — SOFT**, heavily weighted in the objective and topped up
  via **canteen gap-fills**. When even that falls short, the plan reports the
  gap honestly ("20 g short — add 2 eggs ₹16") instead of returning
  "infeasible". A user must never get an empty plate.

The eval mirrors this: `test_kcal_within_band` is strict; `test_protein_floor`
counts canteen gap-fills toward intake.

## Provisional ranges — calibration happens in task 3.2

The kcal/protein bounds in these seed scenarios are *reasonable*, not yet
*verified*: the solver doesn't exist while 3.1 is being built, so true
feasibility can't be confirmed here. When the solver lands we will:
1. run all scenarios, read actual outputs,
2. tighten each `expected_properties` range to what a good plan achieves,
3. export one-page-per-scenario results for nutritionist grading.

## Nutritionist grading (the qualitative layer)

Properties catch mechanical errors; they don't judge whether a plan is one a
nutritionist would prescribe. Per the phase doc:
1. Run the optimizer on all 50 scenarios, export results as a PDF (one page each).
2. 1-hour review with the Amrita nutrition-dept mentor.
3. Each plan graded ✅ would prescribe / ⚠️ minor concern / ❌ would not.
4. Iterate optimizer rules until ≥90 % are ✅.
5. Get written sign-off.

## Status

- [x] Framework, loader, property runner, dish + canteen catalogs
- [x] 6 seed scenarios (goal × diet × condition × allergy × skip)
- [ ] Scale to 50 scenarios
- [ ] Solver (task 3.2) → flip skips to assertions, calibrate ranges
- [ ] Nutritionist grading pass
