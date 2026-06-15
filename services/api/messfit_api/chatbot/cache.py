"""Semantic response cache.

Caches answers to *non-personalized* questions keyed by query embedding, so a
near-duplicate question can be served without another LLM call. Personalized
queries (those referencing the user's own profile/targets) are never cached or
served from cache — that would leak one user's answer to another (cache
poisoning, the spec's pitfall).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .embeddings import to_pgvector

CACHE_THRESHOLD = 0.95  # cosine similarity required for a hit

# First-person + needs/targets phrasing that implies a profile-specific answer.
_PERSONAL_PATTERNS = [
    r"\b(i|my|me|mine|i'm|im)\b",
    r"\bfor me\b",
    r"\bdo i need\b",
    r"\bshould i\b",
]


def is_personalized(query: str) -> bool:
    """True if the query likely depends on the user's own profile."""
    return any(re.search(p, query, re.I) for p in _PERSONAL_PATTERNS)


@dataclass(frozen=True)
class CachedAnswer:
    response: str
    citations: list[Any]
    similarity: float


async def check_cache(
    db: AsyncSession, emb: list[float], threshold: float = CACHE_THRESHOLD
) -> CachedAnswer | None:
    """Return the nearest cached answer above ``threshold``, else None."""
    row = (
        await db.execute(
            text(
                """
                SELECT response, citations,
                       1 - (query_embedding <=> CAST(:emb AS vector)) AS similarity
                FROM chat_cache
                WHERE 1 - (query_embedding <=> CAST(:emb AS vector)) > :threshold
                ORDER BY query_embedding <=> CAST(:emb AS vector)
                LIMIT 1
                """
            ),
            {"emb": to_pgvector(emb), "threshold": threshold},
        )
    ).mappings().first()
    if row is None:
        return None
    return CachedAnswer(
        response=row["response"],
        citations=row["citations"] or [],
        similarity=float(row["similarity"]),
    )


async def store_cache(
    db: AsyncSession, emb: list[float], response: str, citations: list[Any]
) -> None:
    """Persist a non-personalized answer keyed by its query embedding."""
    await db.execute(
        text(
            "INSERT INTO chat_cache (query_embedding, response, citations) "
            "VALUES (CAST(:emb AS vector), :resp, CAST(:cit AS jsonb))"
        ),
        {"emb": to_pgvector(emb), "resp": response, "cit": json.dumps(citations)},
    )
    await db.commit()
