"""KB retrieval: embed the query, then ANN cosine search over kb_chunks.

Vector search is raw SQL (`embedding <=> CAST(:emb AS vector)`) backed by the
HNSW cosine index from migration 010. V1 returns the top-k chunks directly; a
cross-encoder reranker is a documented V2 upgrade.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .embeddings import embed_query, to_pgvector


@dataclass(frozen=True)
class RetrievedChunk:
    id: uuid.UUID
    content: str
    metadata: dict[str, Any]
    similarity: float


async def retrieve(db: AsyncSession, query: str, top_k: int = 5) -> list[RetrievedChunk]:
    """Embed ``query`` and return the ``top_k`` most similar KB chunks."""
    emb = await embed_query(query)
    return await retrieve_by_vector(db, emb, top_k)


async def retrieve_by_vector(
    db: AsyncSession, emb: list[float], top_k: int = 5
) -> list[RetrievedChunk]:
    """Cosine ANN search for a pre-computed query embedding (no network)."""
    rows = (
        (
            await db.execute(
                text(
                    """
                SELECT id, content, metadata,
                       1 - (embedding <=> CAST(:emb AS vector)) AS similarity
                FROM kb_chunks
                ORDER BY embedding <=> CAST(:emb AS vector)
                LIMIT :k
                """
                ),
                {"emb": to_pgvector(emb), "k": top_k},
            )
        )
        .mappings()
        .all()
    )

    return [
        RetrievedChunk(
            id=r["id"],
            content=r["content"],
            metadata=r["metadata"] or {},
            similarity=float(r["similarity"]),
        )
        for r in rows
    ]
