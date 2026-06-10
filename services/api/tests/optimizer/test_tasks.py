"""Unit tests for the Celery optimizer task.

No real Redis, no real broker, no database required.
- Serialisation round-trips are tested directly on inp_to_dict / output_from_dict.
- The task itself is exercised via .apply() which runs inline without a broker.
- get_or_optimize and _get_redis are monkeypatched so no network calls happen.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from messfit_api.optimizer.contracts import (
    Dish,
    GapFill,
    OptimizationInput,
    OptimizationOutput,
    PlateItem,
    CanteenItem,
)
from messfit_api.optimizer.tasks import (
    _inp_from_dict,
    inp_to_dict,
    output_from_dict,
    output_to_dict,
    run_optimizer,
)


# ── minimal builders ───────────────────────────────────────────────────


def _make_dish(**kw) -> Dish:
    defaults = dict(
        id="d_rice",
        name="White Rice",
        category="rice",
        diet_type="vegan",
        serving_unit="katori",
        serving_grams=150.0,
        portion_icon="katori",
        kcal=180.0,
        protein_g=3.0,
        carbs_g=40.0,
        fats_g=0.5,
        fiber_g=0.6,
        sodium_mg=5.0,
        glycemic_index=72,
        allergens=(),
        tags=(),
    )
    defaults.update(kw)
    return Dish(**defaults)


def _make_canteen() -> CanteenItem:
    return CanteenItem(
        id="c_egg",
        name="Boiled Egg",
        cost_inr=10,
        kcal=78.0,
        protein_g=6.3,
        carbs_g=0.6,
        fats_g=5.3,
        diet_type="egg",
        portion_icon="piece",
    )


def _make_input(**kw) -> OptimizationInput:
    dish = kw.pop("dish", _make_dish())
    base: dict = dict(
        daily_kcal=2000.0,
        daily_protein_g=120.0,
        daily_carbs_g=250.0,
        daily_fats_g=55.0,
        diet_type="veg",
        allergies=(),
        conditions=(),
        goal="maintain",
        menu={"lunch": [dish]},
        canteen_items=(_make_canteen(),),
        canteen_budget_inr=50,
        skip_dish_ids=("d_skip",),
    )
    base.update(kw)
    return OptimizationInput(**base)


def _make_output() -> OptimizationOutput:
    item = PlateItem(
        dish_id="d_rice",
        name="White Rice",
        portions=2.0,
        serving_unit="katori",
        portion_icon="katori",
        grams=300.0,
        kcal=360.0,
        protein_g=6.0,
        carbs_g=80.0,
        fats_g=1.0,
        reason="Carbohydrate base — steady fuel for the day",
    )
    gf = GapFill(
        item_id="c_egg",
        name="Boiled Egg",
        portions=2,
        cost_inr=20,
        kcal=156.0,
        protein_g=12.6,
        carbs_g=1.2,
        fats_g=10.6,
        text="Add 2 Boiled Egg from the canteen (₹20) for +13g protein.",
    )
    return OptimizationOutput(
        plan={"lunch": [item]},
        daily_totals={"kcal": 516.0, "protein_g": 18.6, "carbs_g": 81.2, "fats_g": 11.6},
        daily_targets={"kcal": 2000.0, "protein_g": 120.0, "carbs_g": 250.0, "fats_g": 55.0},
        gap_fills=[gf],
        solver_status="Optimal",
        solve_time_ms=88,
    )


# ── input serialisation round-trip ────────────────────────────────────


def test_inp_roundtrip_primitives():
    inp = _make_input()
    recovered = _inp_from_dict(inp_to_dict(inp))

    assert recovered.daily_kcal == inp.daily_kcal
    assert recovered.daily_protein_g == inp.daily_protein_g
    assert recovered.diet_type == inp.diet_type
    assert recovered.goal == inp.goal
    assert recovered.allergies == inp.allergies
    assert recovered.conditions == inp.conditions
    assert recovered.canteen_budget_inr == inp.canteen_budget_inr
    assert recovered.skip_dish_ids == inp.skip_dish_ids


def test_inp_roundtrip_dish():
    original_dish = _make_dish(glycemic_index=72, allergens=("gluten",), tags=("high_gi",))
    inp = _make_input(dish=original_dish)
    recovered = _inp_from_dict(inp_to_dict(inp))

    d = recovered.menu["lunch"][0]
    assert d.id == "d_rice"
    assert d.glycemic_index == 72
    assert d.allergens == ("gluten",)
    assert d.tags == ("high_gi",)
    assert isinstance(d.allergens, tuple)
    assert isinstance(d.tags, tuple)


def test_inp_roundtrip_canteen():
    inp = _make_input()
    recovered = _inp_from_dict(inp_to_dict(inp))

    assert len(recovered.canteen_items) == 1
    c = recovered.canteen_items[0]
    assert c.id == "c_egg"
    assert c.cost_inr == 10
    assert c.protein_g == 6.3
    assert isinstance(recovered.canteen_items, tuple)


def test_inp_roundtrip_dish_with_no_optional_fields():
    """Dish with no glycemic_index / allergens / tags survives the round-trip."""
    dish = _make_dish(glycemic_index=None, allergens=(), tags=())
    inp = _make_input(dish=dish)
    recovered = _inp_from_dict(inp_to_dict(inp))

    d = recovered.menu["lunch"][0]
    assert d.glycemic_index is None
    assert d.allergens == ()
    assert d.tags == ()


# ── output serialisation round-trip ───────────────────────────────────


def test_output_roundtrip_plate_item():
    original = _make_output()
    recovered = output_from_dict(output_to_dict(original))

    item = recovered.plan["lunch"][0]
    assert item.dish_id == "d_rice"
    assert item.portions == 2.0
    assert item.reason == "Carbohydrate base — steady fuel for the day"


def test_output_roundtrip_gap_fill():
    original = _make_output()
    recovered = output_from_dict(output_to_dict(original))

    assert len(recovered.gap_fills) == 1
    gf = recovered.gap_fills[0]
    assert gf.item_id == "c_egg"
    assert gf.protein_g == 12.6
    assert "₹20" in gf.text


def test_output_roundtrip_metadata():
    original = _make_output()
    recovered = output_from_dict(output_to_dict(original))

    assert recovered.solver_status == "Optimal"
    assert recovered.solve_time_ms == 88
    assert recovered.daily_totals == original.daily_totals
    assert recovered.daily_targets == original.daily_targets


# ── task execution ─────────────────────────────────────────────────────


def test_task_calls_get_or_optimize(monkeypatch):
    """Task deserialises the payload, calls get_or_optimize, returns a dict.

    Calling run_optimizer(payload) directly (not .apply()) bypasses Celery's
    broker and result backend so no real Redis connection is needed.
    """
    inp = _make_input()
    expected_output = _make_output()

    monkeypatch.setattr(
        "messfit_api.optimizer.tasks.get_or_optimize",
        lambda _inp, _redis: expected_output,
    )
    monkeypatch.setattr(
        "messfit_api.optimizer.tasks._get_redis",
        lambda: MagicMock(),
    )

    result = run_optimizer(inp_to_dict(inp))

    assert isinstance(result, dict)
    assert result["solver_status"] == "Optimal"
    assert result["solve_time_ms"] == 88
    assert len(result["plan"]["lunch"]) == 1
    assert result["plan"]["lunch"][0]["dish_id"] == "d_rice"


def test_task_result_is_json_safe(monkeypatch):
    """The task's return value must be JSON-serialisable (no dataclasses, tuples, etc.)."""
    import json

    monkeypatch.setattr(
        "messfit_api.optimizer.tasks.get_or_optimize",
        lambda _inp, _redis: _make_output(),
    )
    monkeypatch.setattr(
        "messfit_api.optimizer.tasks._get_redis",
        lambda: MagicMock(),
    )

    result = run_optimizer(inp_to_dict(_make_input()))
    # Must not raise
    json.dumps(result)


def test_task_passes_reconstructed_input_to_solver(monkeypatch):
    """The input reaching get_or_optimize must equal the original OptimizationInput."""
    inp = _make_input()
    received: list[OptimizationInput] = []

    def _fake_get_or_optimize(inner_inp, _redis):
        received.append(inner_inp)
        return _make_output()

    monkeypatch.setattr("messfit_api.optimizer.tasks.get_or_optimize", _fake_get_or_optimize)
    monkeypatch.setattr("messfit_api.optimizer.tasks._get_redis", lambda: MagicMock())

    run_optimizer(inp_to_dict(inp))

    assert len(received) == 1
    assert received[0].goal == inp.goal
    assert received[0].diet_type == inp.diet_type
    assert received[0].menu["lunch"][0].id == "d_rice"
    assert received[0].canteen_items[0].id == "c_egg"
    assert received[0].skip_dish_ids == ("d_skip",)
