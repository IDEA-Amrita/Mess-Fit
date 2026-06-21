"""Pydantic schemas for the chatbot API."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str | None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class MessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    citations: list[Any]
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class RenameIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
