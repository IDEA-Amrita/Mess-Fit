"""Unit tests for the OCR accuracy scorer (deterministic, no network)."""

from __future__ import annotations

from messfit_api.mess.schemas import ParsedDay, ParsedDish, ParsedMeal, ParsedMenu

from ._ocr_scoring import score_parsed

_TRUTH = {
    "weekly": [
        {
            "day": "Monday",
            "meals": [
                {"type": "breakfast", "dishes": ["Idli", "Sambar"]},
                {"type": "lunch", "dishes": ["White Rice", "Rasam"]},
            ],
        }
    ]
}


def _menu(*dishes_by_meal) -> ParsedMenu:
    """dishes_by_meal: (meal_type, [names]) tuples under a single Monday."""
    meals = [
        ParsedMeal(type=mt, dishes=[ParsedDish(name=n) for n in names])
        for mt, names in dishes_by_meal
    ]
    return ParsedMenu(weekly=[ParsedDay(day="Monday", meals=meals)])


def test_perfect_match_scores_one():
    parsed = _menu(
        ("breakfast", ["Idli", "Sambar"]),
        ("lunch", ["White Rice", "Rasam"]),
    )
    res = score_parsed(parsed, _TRUTH)
    assert res.total == 4
    assert res.correct == 4
    assert res.accuracy == 1.0


def test_spelling_variant_counts_as_match():
    # "Idly"/"Sambhar" are OCR-plausible variants and should still match.
    parsed = _menu(
        ("breakfast", ["Idly", "Sambhar"]),
        ("lunch", ["White Rice", "Rasam"]),
    )
    res = score_parsed(parsed, _TRUTH)
    assert res.accuracy == 1.0


def test_wrong_meal_placement_is_a_miss():
    # Right dishes, but breakfast items placed under lunch.
    parsed = _menu(
        ("lunch", ["Idli", "Sambar", "White Rice", "Rasam"]),
    )
    res = score_parsed(parsed, _TRUTH)
    # Only the two genuine lunch items count; the misplaced breakfast ones miss.
    assert res.correct == 2
    assert res.total == 4
    assert "Monday/breakfast/Idli" in res.misses


def test_missing_dish_lowers_accuracy():
    parsed = _menu(
        ("breakfast", ["Idli"]),  # dropped Sambar
        ("lunch", ["White Rice", "Rasam"]),
    )
    res = score_parsed(parsed, _TRUTH)
    assert res.correct == 3
    assert res.total == 4
    assert res.accuracy == 0.75


def test_extra_dishes_do_not_inflate_score():
    # Spurious hallucinated dishes don't add to the truth total.
    parsed = _menu(
        ("breakfast", ["Idli", "Sambar", "Pizza", "Burger"]),
        ("lunch", ["White Rice", "Rasam"]),
    )
    res = score_parsed(parsed, _TRUTH)
    assert res.total == 4
    assert res.accuracy == 1.0


def test_empty_parse_scores_zero():
    res = score_parsed(ParsedMenu(weekly=[]), _TRUTH)
    assert res.correct == 0
    assert res.accuracy == 0.0
