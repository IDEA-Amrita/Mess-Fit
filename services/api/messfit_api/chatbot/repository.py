"""Conversation + message persistence for the chatbot."""

from __future__ import annotations

import uuid
from typing import Any, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import ChatConversationORM, ChatMessageORM


async def create_conversation(
    db: AsyncSession, user_id: uuid.UUID, title: str | None
) -> ChatConversationORM:
    conv = ChatConversationORM(user_id=user_id, title=title)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


async def update_conversation_title(
    db: AsyncSession, conv_id: uuid.UUID, title: str
) -> ChatConversationORM | None:
    conv = await db.get(ChatConversationORM, conv_id)
    if conv:
        conv.title = title
        await db.commit()
        await db.refresh(conv)
    return conv


async def list_conversations(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 50, offset: int = 0
) -> Sequence[ChatConversationORM]:
    return (
        await db.execute(
            select(ChatConversationORM)
            .where(ChatConversationORM.user_id == user_id)
            .order_by(ChatConversationORM.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()


async def get_owned_conversation(
    db: AsyncSession, conv_id: uuid.UUID, user_id: uuid.UUID
) -> ChatConversationORM | None:
    """Return the conversation only if it belongs to ``user_id``."""
    return (
        await db.execute(
            select(ChatConversationORM).where(
                ChatConversationORM.id == conv_id,
                ChatConversationORM.user_id == user_id,
            )
        )
    ).scalar_one_or_none()


async def list_messages(
    db: AsyncSession, conv_id: uuid.UUID, limit: int | None = None
) -> Sequence[ChatMessageORM]:
    stmt = (
        select(ChatMessageORM)
        .where(ChatMessageORM.conversation_id == conv_id)
        .order_by(ChatMessageORM.created_at)
    )
    if limit is not None:
        # Last ``limit`` messages, returned in chronological order.
        stmt = (
            select(ChatMessageORM)
            .where(ChatMessageORM.conversation_id == conv_id)
            .order_by(ChatMessageORM.created_at.desc())
            .limit(limit)
        )
        rows = (await db.execute(stmt)).scalars().all()
        return list(reversed(rows))
    return (await db.execute(stmt)).scalars().all()


async def add_message(
    db: AsyncSession,
    conv_id: uuid.UUID,
    role: str,
    content: str,
    *,
    citations: list[Any] | None = None,
    model: str | None = None,
) -> ChatMessageORM:
    msg = ChatMessageORM(
        conversation_id=conv_id,
        role=role,
        content=content,
        citations=citations or [],
        model=model,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg
