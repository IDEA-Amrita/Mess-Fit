"""The 16 workout templates (4 families × 4 durations), authored as code.

``all_templates()`` is the source of truth seeded into the workout_templates
table by scripts/seed_templates.py and used by the selector + tests.
"""

from __future__ import annotations

from typing import Any

from . import bw_hostel_gain, bw_hostel_lose, gym_bro_split, gym_full_body
from .progression import DURATIONS

_FAMILIES = [bw_hostel_gain, bw_hostel_lose, gym_bro_split, gym_full_body]


def all_templates() -> list[dict[str, Any]]:
    return [fam.make_template(d) for fam in _FAMILIES for d in DURATIONS]
