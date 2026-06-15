"""Tests for KB vector retrieval (Phase 7, task 7.3).

Seeds a throwaway kb_document + chunks with hand-built basis vectors (so cosine
ordering is deterministic and no embedding network is needed), then exercises
retrieve_by_vector. The document is deleted in teardown (chunks CASCADE).
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from messfit_api.chatbot.embeddings import EMBED_DIM, to_pgvector
from messfit_api.chatbot.retrieval import retrieve_by_vector


def _basis(i: int) -> list[float]:
    """A 768-dim unit vector with 1.0 at position ``i``."""
    v = [0.0] * EMBED_DIM
    v[i] = 1.0
    return v


@pytest.fixture
async def seeded_kb(db_session: AsyncSession):
    doc_id = (
        await db_session.execute(
            text(
                "INSERT INTO kb_documents (source, title) "
                "VALUES ('curated', :t) RETURNING id"
            ),
            {"t": f"TestKB-{uuid.uuid4().hex[:8]}"},
        )
    ).scalar_one()

    chunks = {
        "alpha": _basis(0),
        "bravo": _basis(1),
        "charlie": _basis(2),
    }
    ids: dict[str, uuid.UUID] = {}
    for name, vec in chunks.items():
        cid = (
            await db_session.execute(
                text(
                    "INSERT INTO kb_chunks (document_id, content, embedding) "
                    "VALUES (:doc, :content, CAST(:emb AS vector)) RETURNING id"
                ),
                {"doc": doc_id, "content": name, "emb": to_pgvector(vec)},
            )
        ).scalar_one()
        ids[name] = cid
    await db_session.commit()

    yield ids

    await db_session.execute(
        text("DELETE FROM kb_documents WHERE id = :id"), {"id": doc_id}
    )
    await db_session.commit()


async def test_retrieves_nearest_first(seeded_kb, db_session: AsyncSession):
    # Query closest to the 'bravo' basis vector should rank bravo first.
    results = await retrieve_by_vector(db_session, _basis(1), top_k=3)
    contents = [r.content for r in results]
    assert "bravo" in contents
    assert results[0].content == "bravo"
    assert results[0].similarity > 0.99


async def test_respects_top_k(seeded_kb, db_session: AsyncSession):
    results = await retrieve_by_vector(db_session, _basis(0), top_k=1)
    assert len(results) == 1
    assert results[0].content == "alpha"
