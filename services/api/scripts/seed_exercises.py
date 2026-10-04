"""Seed the 50-exercise catalog into the `exercises` table.

The catalog itself lives in ``messfit_api/workouts/exercise_catalog.py`` (data as
versioned code, shared with templates + tests). This script just upserts it.

Idempotent on the TEXT primary key. ``youtube_video_id`` stays NULL on re-seed —
it must be curated by hand (generated IDs would be hallucinated → broken demos).
See EXERCISE_VIDEOS.md.

Run:  uv run python scripts/seed_exercises.py
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_DIR = _SCRIPT_DIR.parent
if str(_PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(_PROJECT_DIR))

from sqlalchemy.dialects.postgresql import insert as pg_insert

from messfit_api.auth.models import UserORM  # noqa: F401 — register FK target
from messfit_api.db import SessionLocal
from messfit_api.workouts.exercise_catalog import EXERCISES
from messfit_api.workouts.models import ExerciseORM

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger("seed_exercises")


async def seed() -> None:
    assert len(EXERCISES) == 50, f"expected 50 exercises, got {len(EXERCISES)}"
    assert len({e["id"] for e in EXERCISES}) == 50, "duplicate exercise ids"

    async with SessionLocal() as db:
        for ex in EXERCISES:
            update_cols = {k: v for k, v in ex.items() if k != "id"}
            # Don't clobber a curated video id with NULL on re-seed.
            update_cols.pop("youtube_video_id", None)
            stmt = (
                pg_insert(ExerciseORM)
                .values(**ex)
                .on_conflict_do_update(index_elements=["id"], set_=update_cols)
            )
            await db.execute(stmt)
        await db.commit()
    logger.info(
        "Seeded %d exercises (youtube_video_id left NULL — curate per README)", len(EXERCISES)
    )


if __name__ == "__main__":
    asyncio.run(seed())
