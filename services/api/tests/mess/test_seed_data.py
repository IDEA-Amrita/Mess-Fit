"""Validates the real seed catalog (scripts/data/dishes.json) against
seed_dishes.py's own validation rules — no DB required.

Regression guard for the diet_type backfill: the entire 74-dish catalog
used to have zero diet_type keys, which meant every dish (including
egg dishes) silently defaulted to the DB column's 'veg' default. This
test fails loudly if that ever regresses, instead of surfacing as a
strict vegetarian being served egg by the optimizer.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from seed_dishes import DATA_FILE, VALID_DIET_TYPES, validate_dish  # noqa: E402

_RECORDS = json.loads(DATA_FILE.read_text(encoding="utf-8"))


def test_seed_catalog_has_no_validation_errors():
    errors: list[str] = []
    for idx, rec in enumerate(_RECORDS):
        errors.extend(validate_dish(rec, idx))
    assert errors == [], "\n".join(errors)


def test_every_dish_has_a_diet_type():
    missing = [r["name"] for r in _RECORDS if not r.get("diet_type")]
    assert missing == [], f"dishes with no diet_type: {missing}"


def test_every_diet_type_is_valid():
    bad = {r["name"]: r["diet_type"] for r in _RECORDS if r.get("diet_type") not in VALID_DIET_TYPES}
    assert bad == {}, f"dishes with an invalid diet_type: {bad}"


def test_dishes_with_egg_allergen_are_not_labeled_veg_or_vegan():
    # The exact bug this backfill fixes: "Egg Roast" had allergens=["eggs"]
    # but no diet_type, so it silently defaulted to "veg" and was served
    # to strict vegetarians.
    offenders = [
        r["name"]
        for r in _RECORDS
        if "eggs" in r.get("allergens", []) and r.get("diet_type") in {"veg", "vegan"}
    ]
    assert offenders == [], f"egg-allergen dishes mislabeled veg/vegan: {offenders}"
