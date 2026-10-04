"""Chatbot endpoint tests (Phase 7, task 7.6).

Network pieces (embedding, retrieval, generation) are monkeypatched so the SSE
flow + persistence are exercised offline. Conversations/messages CASCADE-delete
with the test user.
"""

from __future__ import annotations

import json

import pytest

from messfit_api.chatbot import cache, embeddings, llm, retrieval
from messfit_api.chatbot.embeddings import EMBED_DIM


@pytest.fixture
def stub_pipeline(monkeypatch):
    """Stub embedding/retrieval/generation; no network, no real cache writes."""

    async def fake_embed(_q):
        return [0.0] * EMBED_DIM

    async def fake_retrieve(_db, _emb, top_k=5):
        return []

    async def fake_generate(query, summary, chunks, history):
        for tok in ["Eat ", "more ", "dal."]:
            yield tok

    monkeypatch.setattr(embeddings, "embed_query", fake_embed)
    monkeypatch.setattr(retrieval, "retrieve_by_vector", fake_retrieve)
    monkeypatch.setattr(llm, "generate_response", fake_generate)


def _parse_sse(body: str) -> list[dict]:
    events = []
    for line in body.splitlines():
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


async def test_create_and_list_conversations(client):
    r = await client.post("/api/v1/chat/conversations")
    assert r.status_code == 201
    conv_id = r.json()["id"]

    lst = (await client.get("/api/v1/chat/conversations")).json()
    assert any(c["id"] == conv_id for c in lst)


async def test_messages_404_when_not_owned(client):
    import uuid

    rid = str(uuid.uuid4())
    assert (await client.get(f"/api/v1/chat/conversations/{rid}/messages")).status_code == 404
    r = await client.post(f"/api/v1/chat/conversations/{rid}/messages", json={"content": "hi"})
    assert r.status_code == 404


async def test_stream_and_persist(client, stub_pipeline):
    conv_id = (await client.post("/api/v1/chat/conversations")).json()["id"]

    # Personalized query → cache bypassed entirely.
    resp = await client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        json={"content": "how much protein do I need for me?"},
    )
    assert resp.status_code == 200
    events = _parse_sse(resp.text)
    tokens = "".join(e["token"] for e in events if "token" in e)
    assert tokens == "Eat more dal."
    assert events[-1].get("done") is True

    # Both messages persisted.
    history = (await client.get(f"/api/v1/chat/conversations/{conv_id}/messages")).json()
    assert [m["role"] for m in history] == ["user", "assistant"]
    assert history[1]["content"] == "Eat more dal."


async def test_non_personalized_query_is_cached(client, stub_pipeline, monkeypatch):
    stored: list[tuple] = []

    async def fake_check(_db, _emb, threshold=cache.CACHE_THRESHOLD):
        return None

    async def fake_store(_db, emb, response, citations):
        stored.append((response, citations))

    monkeypatch.setattr(cache, "check_cache", fake_check)
    monkeypatch.setattr(cache, "store_cache", fake_store)

    conv_id = (await client.post("/api/v1/chat/conversations")).json()["id"]
    resp = await client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        json={"content": "what are cheap protein sources?"},
    )
    assert resp.status_code == 200
    assert stored and stored[0][0] == "Eat more dal."
