"""Ingest the curated knowledge base into kb_documents + kb_chunks.

Reads every ``*.md`` (except README.md) under messfit_api/chatbot/kb/, chunks +
embeds it via the Gemini API, and writes rows with raw SQL (VECTOR cast). The
document title is the file's first ``# Heading`` line; source is ``curated``.

Idempotent on (source, title) — safe to re-run after editing articles.

Run:  uv run python scripts/ingest_kb.py
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

from messfit_api.chatbot.ingest import ingest_document
from messfit_api.db import SessionLocal

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger("ingest_kb")

_KB_DIR = _PROJECT_DIR / "messfit_api" / "chatbot" / "kb"


def _title_of(text: str, fallback: str) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return fallback


async def main() -> None:
    files = sorted(p for p in _KB_DIR.glob("*.md") if p.name.lower() != "readme.md")
    if not files:
        logger.warning("no KB markdown files found in %s", _KB_DIR)
        return

    total_chunks = 0
    async with SessionLocal() as db:
        for path in files:
            body = path.read_text(encoding="utf-8")
            title = _title_of(body, path.stem)
            n = await ingest_document(db, source="curated", title=title, body=body)
            total_chunks += n

    logger.info("done: %d documents, %d chunks", len(files), total_chunks)


if __name__ == "__main__":
    asyncio.run(main())
