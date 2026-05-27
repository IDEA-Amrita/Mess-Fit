"""Master seed script – runs all seed scripts in dependency order.

Order: messes → dishes → menus

Usage:
    python scripts/seed_all.py              # full seed
    python scripts/seed_all.py --dry-run    # validate only
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_DIR = _SCRIPT_DIR.parent
if str(_PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(_PROJECT_DIR))

from scripts.seed_messes import seed_messes
from scripts.seed_dishes import seed_dishes
from scripts.seed_menus import seed_menus

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("seed_all")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def run_all(*, dry_run: bool = False, messes: list[str] | None = None) -> None:
    logger.info("=" * 60)
    logger.info("MessFit Database Seeder — Starting full seed pipeline")
    logger.info("Mode: %s", "DRY RUN" if dry_run else "LIVE")
    logger.info("=" * 60)

    # Step 1: Messes
    logger.info("")
    logger.info("─── Step 1/3: Seeding messes ───")
    await seed_messes(dry_run=dry_run)

    # Step 2: Dishes
    logger.info("")
    logger.info("─── Step 2/3: Seeding dishes ───")
    await seed_dishes(dry_run=dry_run)

    # Step 3: Menus
    logger.info("")
    logger.info("─── Step 3/3: Seeding menus ───")
    await seed_menus(messes=messes, dry_run=dry_run)

    logger.info("")
    logger.info("=" * 60)
    logger.info("Full seed pipeline complete!")
    logger.info("=" * 60)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run all seed scripts in order: messes → dishes → menus",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate all data without inserting into DB",
    )
    parser.add_argument(
        "--messes",
        nargs="*",
        type=str,
        default=None,
        help=(
            "Override target mess name(s) for menu seeding. "
            'Example: --messes "Amrita CB Boys A" "Amrita CB Boys B"'
        ),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(run_all(dry_run=args.dry_run, messes=args.messes))


if __name__ == "__main__":
    main()
