"""Semantic cache tests (Phase 7, task 7.5).

chat_cache rows aren't user-scoped, so each test marks its response with a
'TestCache-' prefix and the fixture purges those in teardown.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from messfit_api.chatbot.cache import check_cache, is_personalized, store_cache
from messfit_api.chatbot.embeddings import EMBED_DIM


def _basis(i: int) -> list[float]:
    v = [0.0] * EMBED_DIM
    v[i] = 1.0
    return v


@pytest.fixture
async def clean_cache(db_session: AsyncSession):
    yield
    await db_session.execute(text("DELETE FROM chat_cache WHERE response LIKE 'TestCache-%'"))
    await db_session.commit()


# ─── is_personalized ──────────────────────────────────────────────────


@pytest.mark.parametrize(
    "q",
    [
        "how much protein do I need?",
        "should I bulk or cut?",
        "what is my calorie target?",
        "is this good for me",
    ],
)
def test_personalized_true(q: str):
    assert is_personalized(q) is True


@pytest.mark.parametrize(
    "q",
    [
        "what are cheap protein sources in India?",
        "why does progressive overload matter?",
        "is creatine safe?",
    ],
)
def test_personalized_false(q: str):
    assert is_personalized(q) is False


# ─── store / check ────────────────────────────────────────────────────


async def test_store_then_hit(clean_cache, db_session: AsyncSession):
    await store_cache(db_session, _basis(5), "TestCache-answer", [{"source": "curated"}])
    hit = await check_cache(db_session, _basis(5))
    assert hit is not None
    assert hit.response == "TestCache-answer"
    assert hit.similarity > 0.99
    assert hit.citations == [{"source": "curated"}]


async def test_distant_query_misses(clean_cache, db_session: AsyncSession):
    await store_cache(db_session, _basis(5), "TestCache-answer", [])
    # Orthogonal vector → cosine similarity 0, below threshold.
    assert await check_cache(db_session, _basis(6)) is None
