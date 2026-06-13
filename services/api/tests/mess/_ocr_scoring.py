"""OCR accuracy scorer (shared by the unit + live accuracy tests).

Metric (from the phase doc): accuracy = (dish-name match × correct day-meal
placement) / total ground-truth dishes. For every dish in the hand-labelled
ground truth we check whether the parsed menu has a dish at the *same day and
meal* whose name matches (exact-normalized or a high difflib ratio, to tolerate
minor OCR spelling drift). It's a recall-style score: did we correctly recover
each real menu item, in the right slot?

Not a pytest module (no ``test_`` prefix) — imported by the test files.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from difflib import SequenceMatcher

from messfit_api.mess.schemas import ParsedMenu

# 0.75 tolerates single-character transliteration drift on short dish names
# ("Idly"↔"Idli" = 0.75). Matches are only sought within the same day+meal
# slot, so cross-dish false positives are very unlikely.
_NAME_MATCH_THRESHOLD = 0.75

_DAY_INDEX = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}


def _norm(s: str) -> str:
    return " ".join(s.lower().split())


def _day_index(day: str) -> int | None:
    key = _norm(day)
    if key in _DAY_INDEX:
        return _DAY_INDEX[key]
    for name, idx in _DAY_INDEX.items():
        if name.startswith(key[:3]):
            return idx
    return None


def _name_match(a: str, b: str) -> bool:
    na, nb = _norm(a), _norm(b)
    if na == nb:
        return True
    return SequenceMatcher(None, na, nb).ratio() >= _NAME_MATCH_THRESHOLD


@dataclass
class ScoreResult:
    total: int
    correct: int
    misses: list[str] = field(default_factory=list)

    @property
    def accuracy(self) -> float:
        return self.correct / self.total if self.total else 0.0


def score_parsed(parsed: ParsedMenu, truth: dict) -> ScoreResult:
    """Score a parsed menu against a ground-truth dict.

    truth shape: {"weekly": [{"day": "Monday",
                  "meals": [{"type": "breakfast", "dishes": ["Idli", "Sambar"]}]}]}
    """
    # Index parsed dishes by (day_index, meal_type).
    parsed_index: dict[tuple[int | None, str], list[str]] = {}
    for day in parsed.weekly:
        di = _day_index(day.day)
        for meal in day.meals:
            parsed_index.setdefault((di, meal.type), []).extend(
                d.name for d in meal.dishes
            )

    total = 0
    correct = 0
    misses: list[str] = []
    for tday in truth["weekly"]:
        di = _day_index(tday["day"])
        for tmeal in tday["meals"]:
            candidates = parsed_index.get((di, tmeal["type"]), [])
            for tdish in tmeal["dishes"]:
                total += 1
                if any(_name_match(tdish, c) for c in candidates):
                    correct += 1
                else:
                    misses.append(f"{tday['day']}/{tmeal['type']}/{tdish}")

    return ScoreResult(total=total, correct=correct, misses=misses)
