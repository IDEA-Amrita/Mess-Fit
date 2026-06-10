"""Unit tests for the Redis cache adapter.

No real Redis or database required — the Redis client is mocked with
unittest.mock.MagicMock so this suite runs cleanly offline and in CI.

Coverage:
  * hash determinism and sensitivity
  * serialization round-trip (str and bytes input)
  * cache miss  → solver called, result stored under correct key with correct TTL
  * cache hit   → solver not called, setex not called, cached data returned faithfully
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from messfit_api.optimizer.cache import (
    _KEY_PREFIX,
    _TTL,
    _inp_hash,
    _output_from_json,
    _output_to_json,
    get_or_optimize,
)
from messfit_api.optimizer.contracts import (
    Dish,
    OptimizationInput,
    OptimizationOutput,
    PlateItem,
)


# ── minimal object builders ────────────────────────────────────────────


def _make_dish(**overrides) -> Dish:
    defaults = dict(
        id="d_dal",
        name="Dal",
        category="protein",
        diet_type="vegan",
        serving_unit="katori",
        serving_grams=150.0,
        portion_icon="katori",
        kcal=120.0,
        protein_g=8.0,
        carbs_g=18.0,
        fats_g=2.0,
        fiber_g=5.0,
        sodium_mg=200.0,
        glycemic_index=None,
        allergens=(),
        tags=("high_protein",),
    )
    defaults.update(overrides)
    return Dish(**defaults)


def _make_input(**overrides) -> OptimizationInput:
    dish = overrides.pop("dish", _make_dish())
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
    )
    base.update(overrides)
    return OptimizationInput(**base)


def _make_output(solve_time_ms: int = 42) -> OptimizationOutput:
    item = PlateItem(
        dish_id="d_dal",
        name="Dal",
        portions=1.5,
        serving_unit="katori",
        portion_icon="katori",
        grams=225.0,
        kcal=180.0,
        protein_g=12.0,
        carbs_g=27.0,
        fats_g=3.0,
        reason="Top protein source in this meal — 12g toward your maintenance goal",
    )
    return OptimizationOutput(
        plan={"lunch": [item]},
        daily_totals={"kcal": 180.0, "protein_g": 12.0, "carbs_g": 27.0, "fats_g": 3.0},
        daily_targets={"kcal": 2000.0, "protein_g": 120.0, "carbs_g": 250.0, "fats_g": 55.0},
        gap_fills=[],
        solver_status="Optimal",
        solve_time_ms=solve_time_ms,
    )


# ── hash determinism + sensitivity ────────────────────────────────────


def test_hash_deterministic():
    """Same input always produces the same hash."""
    inp = _make_input()
    assert _inp_hash(inp) == _inp_hash(inp)


def test_hash_is_64_char_hex():
    h = _inp_hash(_make_input())
    assert len(h) == 64
    assert all(c in "0123456789abcdef" for c in h)


def test_hash_changes_on_different_dish_nutrition():
    """A different per-serving protein value changes the hash."""
    inp_a = _make_input()
    inp_b = _make_input(dish=_make_dish(protein_g=10.0))
    assert _inp_hash(inp_a) != _inp_hash(inp_b)


def test_hash_changes_on_different_goal():
    inp_gain = _make_input(goal="gain")
    inp_lose = _make_input(goal="lose")
    assert _inp_hash(inp_gain) != _inp_hash(inp_lose)


def test_hash_changes_on_skip_list():
    inp_a = _make_input()
    inp_b = _make_input(skip_dish_ids=("d_dal",))
    assert _inp_hash(inp_a) != _inp_hash(inp_b)


# ── serialization round-trip ───────────────────────────────────────────


def test_serialization_round_trip():
    original = _make_output()
    recovered = _output_from_json(_output_to_json(original))

    assert recovered.solver_status == original.solver_status
    assert recovered.solve_time_ms == original.solve_time_ms
    assert recovered.daily_totals == original.daily_totals
    assert recovered.daily_targets == original.daily_targets
    assert len(recovered.plan["lunch"]) == 1

    item = recovered.plan["lunch"][0]
    assert item.dish_id == "d_dal"
    assert item.protein_g == 12.0
    assert item.reason == original.plan["lunch"][0].reason


def test_serialization_accepts_bytes():
    """Redis returns bytes from .get(); _output_from_json must handle both."""
    as_bytes = _output_to_json(_make_output()).encode()
    recovered = _output_from_json(as_bytes)
    assert recovered.solver_status == "Optimal"


# ── cache miss ────────────────────────────────────────────────────────


def test_cache_miss_calls_solver_and_stores(monkeypatch):
    """On a miss: solver runs, result is stored with the right key and TTL."""
    inp = _make_input()
    expected = _make_output()

    monkeypatch.setattr("messfit_api.optimizer.cache.optimize", lambda _: expected)

    r = MagicMock()
    r.get.return_value = None

    result = get_or_optimize(inp, r)

    assert result is expected

    key = _KEY_PREFIX + _inp_hash(inp)
    r.get.assert_called_once_with(key)
    r.setex.assert_called_once()

    stored_key, stored_ttl, stored_value = r.setex.call_args.args
    assert stored_key == key
    assert stored_ttl == _TTL
    assert _output_from_json(stored_value).solver_status == "Optimal"


def test_cache_miss_stores_valid_json(monkeypatch):
    """The value written to Redis must be valid JSON (not bytes of the output object)."""
    monkeypatch.setattr("messfit_api.optimizer.cache.optimize", lambda _: _make_output())

    r = MagicMock()
    r.get.return_value = None

    get_or_optimize(_make_input(), r)

    _stored = r.setex.call_args.args[2]
    # Must be a str and parseable
    assert isinstance(_stored, str)
    import json
    data = json.loads(_stored)
    assert "plan" in data and "daily_totals" in data


# ── cache hit ─────────────────────────────────────────────────────────


def test_cache_hit_skips_solver(monkeypatch):
    """On a hit: solver is never called and setex is never called."""
    inp = _make_input()
    cached_json = _output_to_json(_make_output()).encode()

    calls = []
    monkeypatch.setattr(
        "messfit_api.optimizer.cache.optimize",
        lambda _: calls.append(True),
    )

    r = MagicMock()
    r.get.return_value = cached_json

    get_or_optimize(inp, r)

    assert not calls, "Solver must not run on a cache hit"
    r.setex.assert_not_called()


def test_cache_hit_returns_correct_data(monkeypatch):
    """The returned output faithfully reflects the cached data."""
    inp = _make_input()
    cached_json = _output_to_json(_make_output(solve_time_ms=999)).encode()

    # Solver raises if called — ensures we're not falling through to a fresh solve
    monkeypatch.setattr(
        "messfit_api.optimizer.cache.optimize",
        lambda _: (_ for _ in ()).throw(AssertionError("solver must not run")),
    )

    r = MagicMock()
    r.get.return_value = cached_json

    result = get_or_optimize(inp, r)
    assert result.solve_time_ms == 999
    assert result.plan["lunch"][0].dish_id == "d_dal"
