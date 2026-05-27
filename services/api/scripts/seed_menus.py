"""Seed mess menus from menus/*.json into the database.

Reads one or more menu JSON files, resolves dish names → dish IDs,
and upserts rows into mess_menus.

Idempotent: uses ON CONFLICT DO UPDATE on the composite unique constraint
(mess_id, effective_from, day_of_week, meal_type, dish_id).

The same menu can be applied to multiple messes via --messes.
Run with --dry-run to validate without inserting.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from datetime import date
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_DIR = _SCRIPT_DIR.parent
if str(_PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(_PROJECT_DIR))

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from messfit_api.auth.models import UserORM  # noqa: F401 – register FK target
from messfit_api.db import SessionLocal
from messfit_api.mess.models import DishORM, MessMenuORM, MessORM

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("seed_menus")

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
MENUS_DIR = _SCRIPT_DIR / "data" / "menus"

VALID_MEAL_TYPES = {"breakfast", "lunch", "dinner", "snacks"}
VALID_DAYS = set(range(7))  # 0=Monday … 6=Sunday


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_menu_file(data: dict[str, Any], filepath: Path) -> list[str]:
    """Validate the top-level structure of a menu JSON file."""
    errors: list[str] = []
    ctx = filepath.name

    # Required top-level keys
    for key in ("mess_name", "effective_from", "schedule"):
        if key not in data:
            errors.append(f"[{ctx}] Missing required key: '{key}'")

    if errors:
        return errors

    # effective_from must be a valid date
    try:
        date.fromisoformat(data["effective_from"])
    except (ValueError, TypeError):
        errors.append(
            f"[{ctx}] 'effective_from' must be ISO date (YYYY-MM-DD), "
            f"got {data['effective_from']!r}"
        )

    # schedule must be a list
    schedule = data.get("schedule", [])
    if not isinstance(schedule, list) or len(schedule) == 0:
        errors.append(f"[{ctx}] 'schedule' must be a non-empty array")
        return errors

    seen_days: set[int] = set()
    for day_entry in schedule:
        day_idx = day_entry.get("day_of_week")
        day_name = day_entry.get("day_name", "?")

        if day_idx not in VALID_DAYS:
            errors.append(f"[{ctx}/{day_name}] Invalid day_of_week: {day_idx}")
            continue

        if day_idx in seen_days:
            errors.append(f"[{ctx}/{day_name}] Duplicate day_of_week: {day_idx}")
        seen_days.add(day_idx)

        meals = day_entry.get("meals", {})
        if not isinstance(meals, dict) or not meals:
            errors.append(f"[{ctx}/{day_name}] 'meals' must be a non-empty object")
            continue

        for meal_type, dishes in meals.items():
            if meal_type not in VALID_MEAL_TYPES:
                errors.append(
                    f"[{ctx}/{day_name}] Unknown meal_type '{meal_type}'. "
                    f"Valid: {sorted(VALID_MEAL_TYPES)}"
                )
            if not isinstance(dishes, list) or len(dishes) == 0:
                errors.append(
                    f"[{ctx}/{day_name}/{meal_type}] dishes must be a non-empty array"
                )
            elif not all(isinstance(d, str) and d.strip() for d in dishes):
                errors.append(
                    f"[{ctx}/{day_name}/{meal_type}] all dish names must be non-empty strings"
                )

    return errors


# ---------------------------------------------------------------------------
# Dish name resolution
# ---------------------------------------------------------------------------
async def load_dish_lookup(db: Any) -> dict[str, Any]:
    """Load all dishes and return a {name: id} mapping."""
    result = await db.execute(select(DishORM.name, DishORM.id))
    return {row.name: row.id for row in result.all()}


async def resolve_mess_by_name(db: Any, name: str) -> MessORM | None:
    """Look up a mess by exact name."""
    result = await db.execute(select(MessORM).where(MessORM.name == name))
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def seed_menus(
    *,
    menu_files: list[Path] | None = None,
    messes: list[str] | None = None,
    dry_run: bool = False,
) -> None:
    # Discover menu files
    if menu_files is None or len(menu_files) == 0:
        if not MENUS_DIR.exists():
            logger.error("Menus directory not found: %s", MENUS_DIR)
            sys.exit(1)
        menu_files = sorted(MENUS_DIR.glob("*.json"))

    if not menu_files:
        logger.error("No menu JSON files found")
        sys.exit(1)

    logger.info("Processing %d menu file(s)", len(menu_files))

    # Load and validate all files first
    menu_data: list[tuple[Path, dict[str, Any]]] = []
    all_errors: list[str] = []

    for fp in menu_files:
        if not fp.exists():
            all_errors.append(f"File not found: {fp}")
            continue
        logger.info("Reading %s", fp.name)
        with open(fp, encoding="utf-8") as f:
            data = json.load(f)
        all_errors.extend(validate_menu_file(data, fp))
        menu_data.append((fp, data))

    if all_errors:
        for err in all_errors:
            logger.error("Validation: %s", err)
        logger.error("Aborting: %d validation error(s)", len(all_errors))
        sys.exit(1)

    logger.info("All menu files passed structural validation")

    # Collect all unique dish names across all files for resolution
    all_dish_names: set[str] = set()
    for _, data in menu_data:
        for day_entry in data["schedule"]:
            for meal_type, dishes in day_entry["meals"].items():
                all_dish_names.update(dishes)

    logger.info("Found %d unique dish names across all menu files", len(all_dish_names))

    if dry_run:
        logger.info("[DRY RUN] No database changes will be made")
        for fp, data in menu_data:
            target_messes = messes or [data["mess_name"]]
            total_items = sum(
                len(dishes)
                for day in data["schedule"]
                for dishes in day["meals"].values()
            )
            logger.info(
                "[DRY RUN] %s → %d menu items for mess(es): %s",
                fp.name,
                total_items,
                ", ".join(target_messes),
            )
        logger.info("[DRY RUN] Dish names to resolve: %s", sorted(all_dish_names))
        logger.info("[DRY RUN] Complete")
        return

    # Database phase
    async with SessionLocal() as db:
        try:
            # Resolve dish names → IDs
            dish_lookup = await load_dish_lookup(db)
            missing_dishes = all_dish_names - set(dish_lookup.keys())
            if missing_dishes:
                logger.error(
                    "Cannot resolve %d dish name(s) to IDs. "
                    "Run seed_dishes.py first. Missing: %s",
                    len(missing_dishes),
                    sorted(missing_dishes),
                )
                sys.exit(1)

            logger.info("All %d dish names resolved to IDs", len(all_dish_names))

            total_upserted = 0
            total_skipped = 0

            for fp, data in menu_data:
                effective_from = date.fromisoformat(data["effective_from"])
                target_mess_names = messes or [data["mess_name"]]

                for mess_name in target_mess_names:
                    mess = await resolve_mess_by_name(db, mess_name)
                    if mess is None:
                        logger.error(
                            "Mess '%s' not found in database. Run seed_messes.py first.",
                            mess_name,
                        )
                        sys.exit(1)

                    logger.info(
                        "Seeding menu for mess '%s' (id=%s) from %s",
                        mess.name,
                        mess.id,
                        fp.name,
                    )

                    file_upserted = 0
                    for day_entry in data["schedule"]:
                        day_of_week = day_entry["day_of_week"]
                        for meal_type, dish_names in day_entry["meals"].items():
                            for dish_name in dish_names:
                                dish_id = dish_lookup[dish_name]

                                values = {
                                    "mess_id": mess.id,
                                    "effective_from": effective_from,
                                    "day_of_week": day_of_week,
                                    "meal_type": meal_type,
                                    "dish_id": dish_id,
                                    "availability": "usually",
                                }

                                stmt = pg_insert(MessMenuORM).values(**values)
                                stmt = stmt.on_conflict_do_update(
                                    index_elements=["mess_id", "effective_from", "day_of_week", "meal_type", "dish_id"],
                                    set_={"availability": stmt.excluded.availability},
                                )

                                result = await db.execute(stmt)
                                if result.rowcount == 1:
                                    file_upserted += 1
                                else:
                                    total_skipped += 1

                    total_upserted += file_upserted
                    logger.info(
                        "  %s / %s: %d menu items upserted",
                        mess.name,
                        fp.name,
                        file_upserted,
                    )

            await db.commit()
            logger.info(
                "Seed complete — %d total upserted, %d skipped",
                total_upserted,
                total_skipped,
            )
        except SystemExit:
            await db.rollback()
            raise
        except Exception:
            await db.rollback()
            logger.exception("Error during seeding – rolled back transaction")
            sys.exit(1)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed mess menu data into the database")
    parser.add_argument(
        "--menu-files",
        nargs="*",
        type=Path,
        default=None,
        help="Menu JSON file(s). Default: all *.json in data/menus/",
    )
    parser.add_argument(
        "--messes",
        nargs="*",
        type=str,
        default=None,
        help=(
            "Override target mess name(s). If not specified, uses the "
            "'mess_name' from each JSON file. Example: "
            '--messes "Amrita CB Boys A" "Amrita CB Boys B"'
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate data without inserting into DB",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(
        seed_menus(
            menu_files=args.menu_files,
            messes=args.messes,
            dry_run=args.dry_run,
        )
    )


if __name__ == "__main__":
    main()
