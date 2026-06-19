"""Chatbot HTTP endpoints (Phase 7).

POST /api/v1/chat/conversations                     create a conversation
GET  /api/v1/chat/conversations                     list the user's conversations
GET  /api/v1/chat/conversations/{id}/messages       message history
POST /api/v1/chat/conversations/{id}/messages       send a message, stream the reply (SSE)

The streaming handler runs retrieval, cache, generation, and persistence inside
its own DB session (opened in the generator) so it stays valid for the whole
response — the request-scoped session is used only for the ownership check.
"""

from __future__ import annotations

import json
import time
import uuid
from collections.abc import AsyncIterator
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from .. import db as db_module
from ..auth.deps import get_current_user_id
from ..db import get_session
from ..observability.ratelimit import limiter
from ..observability.setup import get_tracer
from ..profile.goal_engine import compute_age, compute_targets
from ..profile.models import ProfileORM
from ..profile.repository import get_profile
from . import cache, embeddings, llm, repository, retrieval
from .schemas import ConversationOut, MessageIn, MessageOut

router = APIRouter(prefix="/api/v1/chat", tags=["chatbot"])

_HISTORY_LIMIT = 10


def _profile_summary(profile: ProfileORM | None, today: date) -> str:
    """A pseudonymized one-line profile summary for the prompt (no name/email)."""
    if profile is None:
        return "User profile: not set up yet."
    targets = compute_targets(
        dob=profile.dob,
        sex=profile.sex,
        height_cm=float(profile.height_cm),
        current_weight_kg=float(profile.current_weight_kg),
        target_rate_kg_per_week=float(profile.target_rate_kg_per_week),
        goal=profile.goal,
        activity_level=profile.activity_level,
        conditions=list(profile.conditions or []),
        today=today,
    )
    age = compute_age(profile.dob, today)
    conditions = ", ".join(profile.conditions or []) or "none"
    return (
        f"User profile: {age}y {profile.sex}, goal: {profile.goal}, "
        f"daily targets: {targets.daily_kcal} kcal, {targets.daily_protein_g}g protein. "
        f"Conditions: {conditions}."
    )


@router.post("/conversations", response_model=ConversationOut, status_code=201)
@limiter.limit("10/minute")
async def create_conversation(
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
):
    return await repository.create_conversation(db, uuid.UUID(user_id), title=None)


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
):
    return await repository.list_conversations(db, uuid.UUID(user_id), limit=limit, offset=offset)


@router.get("/conversations/{conv_id}/messages", response_model=list[MessageOut])
async def conversation_messages(
    conv_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
):
    conv = await repository.get_owned_conversation(db, conv_id, uuid.UUID(user_id))
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return await repository.list_messages(db, conv_id)


@router.post("/conversations/{conv_id}/messages")
@limiter.limit("30/minute")
async def post_message(
    request: Request,
    conv_id: uuid.UUID,
    payload: MessageIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    uid = uuid.UUID(user_id)
    conv = await repository.get_owned_conversation(db, conv_id, uid)
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    query = payload.content

    async def event_stream() -> AsyncIterator[str]:
        # Late binding (db_module.SessionLocal) so tests can swap the factory.
        async with db_module.SessionLocal() as sdb:
            personalized = cache.is_personalized(query)
            citations: list[dict] = []
            full = ""

            # Embed once (used for retrieval + cache key).
            try:
                emb = await embeddings.embed_query(query)
            except Exception:
                emb = None

            # Cache hit (non-personalized only) → serve verbatim.
            if emb is not None and not personalized:
                cached = await cache.check_cache(sdb, emb)
                if cached is not None:
                    full = cached.response
                    citations = list(cached.citations)
                    yield _sse({"token": full})
                    await _persist(sdb, conv_id, query, full, citations)
                    yield _sse({"done": True, "citations": citations})
                    return

            with get_tracer().start_as_current_span("chat.retrieve") as rspan:
                chunks = (
                    await retrieval.retrieve_by_vector(sdb, emb)
                    if emb is not None
                    else []
                )
                rspan.set_attribute("chat.retrieved_chunks", len(chunks))
            citations = [
                {
                    "chunk_id": str(c.id),
                    "source": c.metadata.get("source"),
                    "title": c.metadata.get("title"),
                    "slug": c.metadata.get("slug"),  # deep-link to /learn/<slug>
                }
                for c in chunks
            ]

            profile = await get_profile(sdb, uid)
            summary = _profile_summary(profile, date.today())
            history = [
                {"role": m.role, "content": m.content}
                for m in await repository.list_messages(sdb, conv_id, limit=_HISTORY_LIMIT)
            ]

            with get_tracer().start_as_current_span("chat.generate") as gspan:
                started = time.perf_counter()
                first_token_ms: float | None = None
                async for token in llm.generate_response(
                    query, summary, chunks, history
                ):
                    if first_token_ms is None:
                        first_token_ms = (time.perf_counter() - started) * 1000
                        gspan.set_attribute("chat.first_token_ms", first_token_ms)
                    full += token
                    yield _sse({"token": token})

            full = llm.validate_citations(full, len(chunks))
            await _persist(sdb, conv_id, query, full, citations)
            if not personalized and emb is not None and full.strip():
                await cache.store_cache(sdb, emb, full, citations)

            yield _sse({"done": True, "citations": citations})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def _persist(
    db: AsyncSession, conv_id: uuid.UUID, query: str, answer: str, citations: list[dict]
) -> None:
    await repository.add_message(db, conv_id, "user", query)
    await repository.add_message(
        db, conv_id, "assistant", answer, citations=citations, model=llm.GEMINI_MODEL
    )
