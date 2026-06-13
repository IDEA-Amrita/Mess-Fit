"""Seed the 16 workout templates into the `workout_templates` table.

Templates are authored as code in messfit_api/workouts/templates/; this script
upserts them so workout_logs (FK → workout_templates) can reference them and the
API can read them. Idempotent on the TEXT primary key.

Run:  uv run python scripts/seed_templates.py   (run seed_exercises.py first)
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

from messfit_api.db import SessionLocal
from messfit_api.workouts.models import WorkoutTemplateORM
from messfit_api.workouts.templates import all_templates

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger("seed_templates")


async def seed() -> None:
    templates = all_templates()
    assert len(templates) == 16, f"expected 16 templates, got {len(templates)}"

    async with SessionLocal() as db:
        for tpl in templates:
            update_cols = {k: v for k, v in tpl.items() if k != "id"}
            stmt = (
                pg_insert(WorkoutTemplateORM)
                .values(**tpl)
                .on_conflict_do_update(index_elements=["id"], set_=update_cols)
            )
            await db.execute(stmt)
        await db.commit()
    logger.info("Seeded %d workout templates", len(templates))


if __name__ == "__main__":
    asyncio.run(seed())
