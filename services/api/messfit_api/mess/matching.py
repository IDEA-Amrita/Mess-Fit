"""Fuzzy dish-name matching for the OCR pipeline.

A photo says "Sambhar"; the catalog has "sambar". We resolve OCR'd names to
existing dishes so the same dish isn't duplicated every time a mess is
onboarded. Two signals, combined:

* **pg_trgm trigram similarity** (Postgres, indexed by ``idx_dishes_name_trgm``)
  — robust to spelling drift and word order, the primary ranker.
* **difflib.SequenceMatcher** (stdlib) — a character-sequence ratio used to
  break ties / sanity-check the top trigram hit, with no extra extension
  (``fuzzystrmatch``) or dependency.

A candidate at or above ``MATCH_THRESHOLD`` is a suggested match; below it the
caller creates a draft dish flagged for review.
"""

from __future__ import annotations

from difflib import SequenceMatcher

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .schemas import DishMatch

MATCH_THRESHOLD = 0.7
_CANDIDATE_LIMIT = 5


def _difflib_ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


async def match_dish_name(db: AsyncSession, name: str) -> list[DishMatch]:
    """Return catalog dishes similar to ``name``, best first.

    Score is the max of the pg_trgm similarity and the difflib ratio, so a hit
    on either signal counts. Only candidates with trigram similarity > 0.1 are
    pulled from the DB (keeps the query cheap); final ranking uses the blended
    score. The list may be empty — that means "no match, create a draft".
    """
    cleaned = name.strip()
    if not cleaned:
        return []

    # pg_trgm: set_limit governs the % operator; we instead filter on
    # similarity() directly so the threshold lives in one place (here).
    rows = (
        await db.execute(
            text(
                """
                SELECT id, name, similarity(name, :q) AS sim
                FROM dishes
                WHERE similarity(name, :q) > 0.1
                ORDER BY sim DESC
                LIMIT :lim
                """
            ),
            {"q": cleaned, "lim": _CANDIDATE_LIMIT},
        )
    ).all()

    matches = [
        DishMatch(
            dish_id=row.id,
            name=row.name,
            score=round(max(float(row.sim), _difflib_ratio(cleaned, row.name)), 3),
        )
        for row in rows
    ]
    matches.sort(key=lambda m: m.score, reverse=True)
    return matches


def best_match(matches: list[DishMatch]) -> DishMatch | None:
    """The top candidate if it clears the threshold, else None (→ draft dish)."""
    if matches and matches[0].score >= MATCH_THRESHOLD:
        return matches[0]
    return None
