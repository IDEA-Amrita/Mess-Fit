"""Tests for fuzzy dish-name matching (pg_trgm + difflib).

Dishes are inserted in the test's own session WITHOUT commit, so they're
visible to the match query (same transaction) and roll back on teardown —
isolated in a clean CI database, harmless against a populated dev one.
ON CONFLICT DO NOTHING keeps it safe if a same-named dish already exists.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from messfit_api.mess.matching import best_match, match_dish_name

_SEED = [
    ("Sambar", "dal"),
    ("Idli", "snack"),
    ("Lemon Rice", "rice"),
    ("Chapathi", "roti"),
    ("Kadala Curry", "curry"),
]


@pytest.fixture
async def seeded_dishes(db_session: AsyncSession):
    for name, category in _SEED:
        await db_session.execute(
            text(
                """
                INSERT INTO dishes (name, category, diet_type, default_serving_unit,
                    default_serving_grams, kcal, protein_g, carbs_g, fats_g)
                VALUES (:name, :cat, 'veg', 'katori', 100, 100, 5, 15, 2)
                ON CONFLICT (name, default_serving_unit) DO NOTHING
                """
            ),
            {"name": name, "cat": category},
        )
    # No commit: rows live only in this transaction and roll back on teardown.
    yield db_session


async def test_exact_name_matches(seeded_dishes):
    matches = await match_dish_name(seeded_dishes, "Sambar")
    assert best_match(matches) is not None
    assert best_match(matches).name == "Sambar"
    assert best_match(matches).score >= 0.7


async def test_misspelling_matches(seeded_dishes):
    # "Sambhar" (extra h) is the classic menu-board variant of "Sambar".
    matches = await match_dish_name(seeded_dishes, "Sambhar")
    top = best_match(matches)
    assert top is not None
    assert top.name == "Sambar"
    assert top.score >= 0.7


async def test_case_and_spelling_variant(seeded_dishes):
    matches = await match_dish_name(seeded_dishes, "idly")
    top = best_match(matches)
    assert top is not None
    # Accept either spelling — the catalog may already hold "Idly" (the real
    # seed spelling), which legitimately out-ranks the inserted "Idli".
    assert top.name.lower() in {"idli", "idly"}
    assert top.score >= 0.7


async def test_multiword_variant(seeded_dishes):
    matches = await match_dish_name(seeded_dishes, "lemon rice")
    top = best_match(matches)
    assert top is not None
    assert top.name == "Lemon Rice"


async def test_genuine_miss_returns_no_confident_match(seeded_dishes):
    # Nonsense token close to nothing in the catalog → draft-dish path.
    matches = await match_dish_name(seeded_dishes, "Qwxzptlk Zndglf")
    assert best_match(matches) is None


async def test_empty_name_returns_empty(seeded_dishes):
    assert await match_dish_name(seeded_dishes, "   ") == []
