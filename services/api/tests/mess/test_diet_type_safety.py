"""A dish without an explicit diet label must never reach a vegetarian.

Before, four paths silently labelled such a dish "veg": the dishes column
default, the admin create schema, and both AI estimates (menu OCR drafts and
photo-scanned menus). DB-free: schemas, the solver's diet filter, and the ORM
column definition.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from messfit_api.mess import ocr
from messfit_api.mess.models import DishORM
from messfit_api.mess.schemas import DishBase, NutritionEstimate
from messfit_api.optimizer.contracts import CanteenItem, Dish
from messfit_api.optimizer.solver import is_diet_compatible
from messfit_api.tracking import vision
from messfit_api.tracking.vision import ExtractedDish

_DISH = {
    "name": "Mystery Curry",
    "category": "curry",
    "default_serving_unit": "katori",
    "default_serving_grams": 150.0,
    "kcal": 200.0,
    "protein_g": 8.0,
    "carbs_g": 20.0,
    "fats_g": 9.0,
}


def test_admin_cannot_create_a_dish_without_a_diet_label():
    with pytest.raises(ValidationError) as e:
        DishBase(**_DISH)
    assert "diet_type" in str(e.value)
    assert DishBase(**_DISH, diet_type="egg").diet_type == "egg"


def test_unclassified_ai_estimates_are_treated_as_non_veg():
    assert NutritionEstimate().diet_type == "non_veg"
    scanned = ExtractedDish(
        name="Mystery Curry",
        category="curry",
        serving_grams=150,
        kcal=200,
        protein_g=8,
        carbs_g=20,
        fats_g=9,
    )
    assert scanned.diet_type == "non_veg"


def _dish(diet_type: str) -> Dish:
    return Dish(
        id="d1",
        name="Mystery Curry",
        category="curry",
        diet_type=diet_type,
        serving_unit="katori",
        serving_grams=150,
        portion_icon="katori",
        kcal=200,
        protein_g=8,
        carbs_g=20,
        fats_g=9,
    )


@pytest.mark.parametrize("user_diet", ["vegan", "veg", "egg"])
def test_the_fallback_label_keeps_the_dish_off_every_restricted_plate(user_diet):
    assert is_diet_compatible(_dish("non_veg"), user_diet) is False


def test_the_fallback_label_still_serves_people_who_eat_everything():
    assert is_diet_compatible(_dish("non_veg"), "non_veg") is True


def test_the_dishes_column_has_no_default_label():
    column = DishORM.__table__.c.diet_type
    assert column.server_default is None
    assert column.nullable is False


def test_canteen_items_must_be_labelled_too():
    with pytest.raises(TypeError):
        CanteenItem(
            id="c1", name="Boiled Egg", cost_inr=8, kcal=70, protein_g=6, carbs_g=0.5, fats_g=5
        )  # type: ignore[call-arg]


def test_both_ai_prompts_ask_for_the_label_and_the_safe_fallback():
    for prompt in (ocr._NUTRITION_PROMPT, vision._MENU_PHOTO_PROMPT):
        assert "diet_type" in prompt
        assert "non_veg" in prompt and "unsure" in prompt.replace("not sure", "unsure")
