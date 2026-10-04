import pytest
from pydantic import ValidationError
from messfit_api.tracking.vision import ExtractedDish


def test_extracted_dish_valid():
    dish = ExtractedDish(
        name="Paneer Butter Masala",
        category="curry",
        serving_grams=200,
        kcal=450,
        protein_g=15,
        carbs_g=20,
        fats_g=30,
    )
    assert dish.name == "Paneer Butter Masala"
    assert dish.protein_g == 15


def test_extracted_dish_caps_hallucinated_macros():
    # If the LLM hallucinates 200g of protein in a 100g serving, it must cap at 100g.
    dish = ExtractedDish(
        name="Impossible Protein Shake",
        category="beverage",
        serving_grams=100,
        kcal=800,
        protein_g=200,  # Impossible but within Pydantic bounds
        carbs_g=50,
        fats_g=20,
    )
    # The @model_validator should have capped it
    assert dish.protein_g == 100
    assert dish.carbs_g == 50


def test_extracted_dish_caps_all_macros():
    dish = ExtractedDish(
        name="Magic Cube",
        category="snack",
        serving_grams=50,
        kcal=1000,
        protein_g=100,
        carbs_g=100,
        fats_g=100,
    )
    assert dish.protein_g == 50
    assert dish.carbs_g == 50
    assert dish.fats_g == 50


def test_extracted_dish_rejects_negative_macros():
    with pytest.raises(ValidationError):
        ExtractedDish(
            name="Negative Food",
            category="snack",
            serving_grams=100,
            kcal=-50,  # Invalid
            protein_g=10,
            carbs_g=10,
            fats_g=10,
        )
