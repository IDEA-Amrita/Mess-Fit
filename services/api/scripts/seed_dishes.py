"""Seed dishes from dishes.json into the database.

Idempotent: uses ON CONFLICT DO UPDATE on (name, default_serving_unit).
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
# Path setup
# ---------------------------------------------------------------------------
_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_DIR = _SCRIPT_DIR.parent
if str(_PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(_PROJECT_DIR))

from sqlalchemy.dialects.postgresql import insert as pg_insert

from messfit_api.auth.models import UserORM  # noqa: F401 – register FK target
from messfit_api.db import SessionLocal
from messfit_api.mess.models import DishORM

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("seed_dishes")

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
DATA_FILE = _SCRIPT_DIR / "data" / "dishes.json"

REQUIRED_FIELDS = {
    "name",
    "category",
    "diet_type",
    "default_serving_unit",
    "default_serving_grams",
    "kcal",
    "protein_g",
    "carbs_g",
    "fats_g",
}

NUMERIC_FIELDS = {
    "default_serving_grams": (0.01, 9999),
    "kcal": (0, 9999),
    "protein_g": (0, 999),
    "carbs_g": (0, 999),
    "fats_g": (0, 999),
    "fiber_g": (0, 999),
    "sodium_mg": (0, 9999),
}

VALID_CATEGORIES = {
    "rice",
    "roti",
    "curry",
    "sabzi",
    "dal",
    "snack",
    "sweet",
    "beverage",
    "protein",
    "salad",
    "other",
}

# Must match the CHECK constraint on dishes.diet_type (migration 006).
VALID_DIET_TYPES = {"vegan", "veg", "egg", "non_veg"}

VALID_CONFIDENCE = {"verified", "estimated", "user_reported"}

# Columns to update on conflict (everything except the unique key)
UPDATE_COLS = [
    "name_local",
    "category",
    "diet_type",
    "default_serving_grams",
    "kcal",
    "protein_g",
    "carbs_g",
    "fats_g",
    "fiber_g",
    "sodium_mg",
    "glycemic_index",
    "allergens",
    "tags",
    "portion_icon",
    "confidence",
    "source",
]


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_dish(record: dict[str, Any], index: int) -> list[str]:
    """Return a list of validation error strings (empty = valid)."""
    errors: list[str] = []

    # Required fields
    missing = REQUIRED_FIELDS - set(record.keys())
    if missing:
        errors.append(f"[{index}] Missing required field(s): {missing}")
        return errors  # can't validate further

    # String fields
    for field in ("name", "category", "default_serving_unit"):
        if not isinstance(record[field], str) or not record[field].strip():
            errors.append(f"[{index}] '{field}' must be a non-empty string")

    # Numeric ranges
    for field, (lo, hi) in NUMERIC_FIELDS.items():
        val = record.get(field)
        if val is None and field not in REQUIRED_FIELDS:
            continue  # optional
        if val is None:
            errors.append(f"[{index}] '{field}' is required")
            continue
        try:
            fval = float(val)
        except (TypeError, ValueError):
            errors.append(f"[{index}] '{field}' must be a number, got {val!r}")
            continue
        if not (lo <= fval <= hi):
            errors.append(f"[{index}] '{field}' = {fval} out of range [{lo}, {hi}]")

    # Category
    cat = record.get("category", "")
    if isinstance(cat, str) and cat.strip() and cat.strip() not in VALID_CATEGORIES:
        errors.append(
            f"[{index}] Unknown category '{cat}'. "
            f"Valid: {sorted(VALID_CATEGORIES)}"
        )

    # Diet type — must match the DB's CHECK constraint exactly. No default:
    # the column's own DB-level default of 'veg' is what silently mislabeled
    # every egg dish in this catalog as vegetarian, so the seed script must
    # never rely on it — every record has to state its diet explicitly.
    diet_type = record.get("diet_type", "")
    if not isinstance(diet_type, str) or diet_type.strip() not in VALID_DIET_TYPES:
        errors.append(
            f"[{index}] '{record.get('name', '?')}': diet_type must be one of "
            f"{sorted(VALID_DIET_TYPES)}, got {diet_type!r}"
        )

    # Confidence
    conf = record.get("confidence", "estimated")
    if conf not in VALID_CONFIDENCE:
        errors.append(f"[{index}] Invalid confidence '{conf}'")

    # Source citation
    if not record.get("source"):
        errors.append(f"[{index}] 'source' is required for data provenance")

    return errors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def seed_dishes(*, data_file: Path = DATA_FILE, dry_run: bool = False) -> None:
    logger.info("Loading dishes from %s", data_file)

    if not data_file.exists():
        logger.error("Data file not found: %s", data_file)
        sys.exit(1)

    with open(data_file, encoding="utf-8") as f:
        records: list[dict[str, Any]] = json.load(f)

    if not isinstance(records, list):
        logger.error("Expected a JSON array of dish objects")
        sys.exit(1)

    logger.info("Found %d dish record(s) to process", len(records))

    # Validate all records upfront
    all_errors: list[str] = []
    for idx, rec in enumerate(records):
        all_errors.extend(validate_dish(rec, idx))

    if all_errors:
        for err in all_errors:
            logger.error("Validation: %s", err)
        logger.error("Aborting: %d validation error(s)", len(all_errors))
        sys.exit(1)

    logger.info("All records passed validation")

    if dry_run:
        logger.info("[DRY RUN] No database changes will be made")
        for rec in records:
            logger.info(
                "[DRY RUN] Would upsert dish: %s (%s)",
                rec["name"],
                rec["default_serving_unit"],
            )
        logger.info("[DRY RUN] Complete – %d record(s) validated", len(records))
        return

    # Upsert into DB
    upserted = 0
    skipped = 0

    async with SessionLocal() as db:
        try:
            for rec in records:
                values = {
                    "name": rec["name"].strip(),
                    "name_local": rec.get("name_local", {}),
                    "category": rec["category"].strip(),
                    "diet_type": rec["diet_type"].strip(),
                    "default_serving_unit": rec["default_serving_unit"].strip(),
                    "default_serving_grams": float(rec["default_serving_grams"]),
                    "kcal": float(rec["kcal"]),
                    "protein_g": float(rec["protein_g"]),
                    "carbs_g": float(rec["carbs_g"]),
                    "fats_g": float(rec["fats_g"]),
                    "fiber_g": float(rec.get("fiber_g", 0)),
                    "sodium_mg": float(rec.get("sodium_mg", 0)),
                    "glycemic_index": rec.get("glycemic_index"),
                    "allergens": rec.get("allergens", []),
                    "tags": rec.get("tags", []),
                    "portion_icon": rec.get("portion_icon", "katori"),
                    "confidence": rec.get("confidence", "estimated"),
                    "source": rec.get("source"),
                }

                stmt = pg_insert(DishORM).values(**values)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["name", "default_serving_unit"],
                    set_={col: stmt.excluded[col] for col in UPDATE_COLS},
                )

                result = await db.execute(stmt)
                if result.rowcount == 1:
                    upserted += 1
                else:
                    skipped += 1

            await db.commit()
            logger.info(
                "Seed complete — %d upserted, %d skipped", upserted, skipped
            )
        except Exception:
            await db.rollback()
            logger.exception("Error during seeding – rolled back transaction")
            sys.exit(1)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed dish data into the database")
    parser.add_argument(
        "--data-file",
        type=Path,
        default=DATA_FILE,
        help="Path to dishes.json (default: %(default)s)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate data without inserting into DB",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(seed_dishes(data_file=args.data_file, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
