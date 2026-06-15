"""Knowledge-base ingestion: markdown files -> kb_documents + kb_chunks.

A document is chunked with a sliding window (snapped to sentence boundaries),
each chunk is embedded via the Gemini API, and rows are written with raw SQL so
the VECTOR(768) column can be cast from a text literal without a pgvector codec.

Idempotent per (source, title): an existing document of the same source+title is
deleted (its chunks CASCADE) and re-inserted, so re-running picks up edits.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .embeddings import embed_texts, to_pgvector

logger = logging.getLogger(__name__)

_TARGET_CHARS = 2000  # ~500 tokens at ~4 chars/token
_OVERLAP_CHARS = 400  # ~100 tokens


def chunk_text(body: str, target_chars: int = _TARGET_CHARS,
               overlap_chars: int = _OVERLAP_CHARS) -> list[str]:
    """Sliding-window chunker that snaps each cut to a sentence boundary.

    Advances by a fixed step (``target - overlap``) computed from ``target_chars``,
    never from the snapped window length — otherwise a short tail would shrink the
    step below the overlap and the loop would crawl one char at a time.
    """
    body = body.strip()
    if not body:
        return []
    step = max(target_chars - overlap_chars, 1)
    chunks: list[str] = []
    i = 0
    n = len(body)
    while i < n:
        window = body[i : i + target_chars]
        # Snap to the last sentence end in the back third of the window.
        if i + target_chars < n:
            cut = window.rfind(". ")
            if cut > target_chars * 0.6:
                window = window[: cut + 1]
        chunk = window.strip()
        if chunk:
            chunks.append(chunk)
        i += step
    return chunks


async def ingest_document(
    db: AsyncSession,
    *,
    source: str,
    title: str,
    body: str,
    extra_meta: dict[str, Any] | None = None,
) -> int:
    """Ingest one document. Returns the number of chunks written.

    ``extra_meta`` (e.g. ``{"slug": ..., "tags": [...]}``) is merged into every
    chunk's metadata so retrieval/citations can carry it through (used for
    deep-linking chat citations to /learn/<slug>).
    """
    chunks = chunk_text(body)
    if not chunks:
        return 0

    # Idempotent: drop any prior document with this source+title (chunks CASCADE).
    await db.execute(
        text("DELETE FROM kb_documents WHERE source = :s AND title = :t"),
        {"s": source, "t": title},
    )
    doc_id = (
        await db.execute(
            text(
                "INSERT INTO kb_documents (source, title) "
                "VALUES (:s, :t) RETURNING id"
            ),
            {"s": source, "t": title},
        )
    ).scalar_one()

    embeddings = await embed_texts(chunks)
    if len(embeddings) != len(chunks):
        raise RuntimeError(
            f"embedding count {len(embeddings)} != chunk count {len(chunks)}"
        )

    for idx, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        await db.execute(
            text(
                "INSERT INTO kb_chunks (document_id, content, embedding, metadata) "
                "VALUES (:doc, :content, CAST(:emb AS vector), CAST(:meta AS jsonb))"
            ),
            {
                "doc": doc_id,
                "content": chunk,
                "emb": to_pgvector(emb),
                "meta": _meta_json(source, title, idx, extra_meta),
            },
        )
    await db.commit()
    logger.info("ingested %r (%s): %d chunks", title, source, len(chunks))
    return len(chunks)


def _meta_json(
    source: str, title: str, idx: int, extra: dict[str, Any] | None = None
) -> str:
    import json

    meta: dict[str, Any] = {"source": source, "title": title, "chunk_index": idx}
    if extra:
        meta.update(extra)
    return json.dumps(meta)
