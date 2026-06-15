"""Text embeddings via the Gemini API.

text-embedding-004 returns 768-dim vectors (matches VECTOR(768) in migration 010).
Kept thin and separate from callers so tests can monkeypatch ``embed_texts`` /
``embed_query`` with canned vectors and exercise retrieval/cache with no network.
"""

from __future__ import annotations

from ..config import settings

# gemini-embedding-001 is the current stable embedding model. Its native dim is
# 3072; we request 768 (Matryoshka truncation) to match VECTOR(768) in the schema.
EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 768
_MAX_BATCH = 100  # Gemini batch-embed limit


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts. Returns one 768-float vector per input.

    Splits into batches of <=100 (the API's per-request limit) and concatenates.
    """
    if not texts:
        return []
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    config = types.EmbedContentConfig(output_dimensionality=EMBED_DIM)
    out: list[list[float]] = []
    for start in range(0, len(texts), _MAX_BATCH):
        batch = texts[start : start + _MAX_BATCH]
        resp = await client.aio.models.embed_content(
            model=EMBED_MODEL, contents=batch, config=config
        )
        out.extend(list(e.values or []) for e in (resp.embeddings or []))
    return out


async def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    vecs = await embed_texts([text])
    if not vecs:
        raise RuntimeError("embedding API returned no vector")
    return vecs[0]


def to_pgvector(vec: list[float]) -> str:
    """Render a vector as the pgvector text literal ``[0.1,0.2,...]``.

    Bound as a string and cast with ``CAST(:emb AS vector)`` in SQL, so we don't
    need the pgvector python package or an asyncpg codec.
    """
    return "[" + ",".join(repr(float(x)) for x in vec) + "]"
