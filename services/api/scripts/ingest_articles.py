"""Ingest the public /learn articles into the chatbot knowledge base.

The 15 articles in apps/web/src/content/articles/ are the single curated KB
source (Phase 8 consolidated the Phase 7 starter files onto them). Each article
becomes a kb_document (source='curated') chunked + embedded as in Phase 7, with
its slug + tags stored in chunk metadata so chat citations can deep-link to
/learn/<slug>.

Full refresh: every source='curated' document is deleted first, so renamed or
removed articles never leave orphan chunks. Re-run after editing any article —
the chatbot won't see changes otherwise.

Run:  uv run python scripts/ingest_articles.py
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

from sqlalchemy import text

from messfit_api.chatbot.ingest import ingest_document
from messfit_api.db import SessionLocal

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger("ingest_articles")

# apps/web/src/content/articles relative to repo root (…/Mess-Fit).
_REPO_ROOT = _PROJECT_DIR.parent.parent
_ARTICLES_DIR = _REPO_ROOT / "apps" / "web" / "src" / "content" / "articles"


def _parse_frontmatter(raw: str) -> tuple[dict[str, object], str]:
    """Minimal YAML-frontmatter parser (no pyyaml dep).

    Handles ``key: value`` and ``tags: [a, b, c]``; strips surrounding quotes.
    Returns (frontmatter dict, body).
    """
    lines = raw.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, raw
    fm: dict[str, object] = {}
    i = 1
    while i < len(lines) and lines[i].strip() != "---":
        line = lines[i]
        i += 1
        if not line.strip() or ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            items = [v.strip().strip("\"'") for v in value[1:-1].split(",")]
            fm[key] = [v for v in items if v]
        else:
            fm[key] = value.strip("\"'")
    body = "\n".join(lines[i + 1 :]) if i < len(lines) else ""
    return fm, body


async def main() -> None:
    if not _ARTICLES_DIR.is_dir():
        logger.error("articles dir not found: %s", _ARTICLES_DIR)
        sys.exit(1)

    files = sorted(_ARTICLES_DIR.glob("*.md"))
    if not files:
        logger.warning("no article markdown files in %s", _ARTICLES_DIR)
        return

    total_chunks = 0
    async with SessionLocal() as db:
        # Full refresh of the curated KB so retired topics leave no orphans.
        await db.execute(text("DELETE FROM kb_documents WHERE source = 'curated'"))
        await db.commit()

        for path in files:
            raw = path.read_text(encoding="utf-8")
            fm, body = _parse_frontmatter(raw)
            slug = str(fm.get("slug") or path.stem)
            title = str(fm.get("title") or path.stem)
            tags = fm.get("tags") or []
            n = await ingest_document(
                db,
                source="curated",
                title=title,
                body=body,
                extra_meta={"slug": slug, "tags": tags},
            )
            total_chunks += n

    logger.info("done: %d articles, %d chunks", len(files), total_chunks)


if __name__ == "__main__":
    asyncio.run(main())
