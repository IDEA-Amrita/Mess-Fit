"""Seed messes from messes.json into the database.

Idempotent: uses ON CONFLICT DO UPDATE on (college, name).
Run with --dry-run to validate without inserting.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Path setup – allow running as `python scripts/seed_messes.py`
# ---------------------------------------------------------------------------
_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_DIR = _SCRIPT_DIR.parent
if str(_PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(_PROJECT_DIR))

from sqlalchemy.dialects.postgresql import insert as pg_insert

from messfit_api.auth.models import UserORM  # noqa: F401 – register FK target
from messfit_api.db import SessionLocal
from messfit_api.mess.models import MessORM

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("seed_messes")

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
DATA_FILE = _SCRIPT_DIR / "data" / "messes.json"

REQUIRED_FIELDS = {"name", "college", "city"}


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_mess(record: dict[str, Any], index: int) -> list[str]:
    """Return a list of validation error strings (empty = valid)."""
    errors: list[str] = []

    missing = REQUIRED_FIELDS - set(record.keys())
    if missing:
        errors.append(f"[{index}] Missing required field(s): {missing}")

    for field in REQUIRED_FIELDS & set(record.keys()):
        if not isinstance(record[field], str) or not record[field].strip():
            errors.append(f"[{index}] Field '{field}' must be a non-empty string")

    return errors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def seed_messes(*, data_file: Path = DATA_FILE, dry_run: bool = False) -> None:
    logger.info("Loading messes from %s", data_file)

    if not data_file.exists():
        logger.error("Data file not found: %s", data_file)
        sys.exit(1)

    with open(data_file, encoding="utf-8") as f:
        records: list[dict[str, Any]] = json.load(f)

    if not isinstance(records, list):
        logger.error("Expected a JSON array of mess objects")
        sys.exit(1)

    logger.info("Found %d mess record(s) to process", len(records))

    # Validate all records upfront
    all_errors: list[str] = []
    for idx, rec in enumerate(records):
        all_errors.extend(validate_mess(rec, idx))

    if all_errors:
        for err in all_errors:
            logger.error("Validation: %s", err)
        logger.error("Aborting: %d validation error(s)", len(all_errors))
        sys.exit(1)

    logger.info("All records passed validation")

    if dry_run:
        logger.info("[DRY RUN] No database changes will be made")
        for rec in records:
            logger.info("[DRY RUN] Would upsert mess: %s @ %s", rec["name"], rec["college"])
        logger.info("[DRY RUN] Complete – %d record(s) validated", len(records))
        return

    # Upsert into DB
    inserted = 0
    updated = 0

    async with SessionLocal() as db:
        try:
            for rec in records:
                values = {
                    "name": rec["name"].strip(),
                    "college": rec["college"].strip(),
                    "city": rec["city"].strip(),
                }

                stmt = pg_insert(MessORM).values(**values)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["college", "name"],
                    set_={"city": stmt.excluded.city},
                )

                result = await db.execute(stmt)

                # xmax == 0 → fresh INSERT; xmax != 0 → UPDATE of existing row
                # For PostgreSQL, we check if row was inserted or updated via rowcount
                if result.rowcount == 1:
                    # We can't directly distinguish insert vs update with on_conflict
                    # so we count all as "upserted"
                    inserted += 1

            await db.commit()
            logger.info(
                "Seed complete — %d record(s) upserted (inserted or updated)",
                inserted,
            )
        except Exception:
            await db.rollback()
            logger.exception("Error during seeding – rolled back transaction")
            sys.exit(1)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed mess data into the database")
    parser.add_argument(
        "--data-file",
        type=Path,
        default=DATA_FILE,
        help="Path to messes.json (default: %(default)s)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate data without inserting into DB",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(seed_messes(data_file=args.data_file, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
