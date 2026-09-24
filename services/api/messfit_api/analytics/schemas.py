"""Wire types for product analytics.

The privacy guarantees live here, at the boundary: only allow-listed event
names are accepted, and props are a handful of short slug-like scalars, so
free text (which could contain anything a user typed) can never be stored.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Literal, Union, get_args

from pydantic import BaseModel, Field, field_validator

EventName = Literal[
    "session_start",
    "onboarding_completed",
    "plate_viewed",
    "meal_logged",
    "weight_logged",
    "workout_saved",
    "chat_message_sent",
    "notifications_enabled",
    "pwa_installed",
    "article_opened",
]

ALLOWED_EVENTS: tuple[str, ...] = get_args(EventName)

_SLUG = re.compile(r"^[a-z0-9][a-z0-9_.:-]{0,63}$")
_KEY = re.compile(r"^[a-z][a-z0-9_]{0,31}$")
MAX_PROPS = 8
MAX_BATCH = 20
# Events are queued on the device and flushed later; accept modest clock skew
# and delay, but not arbitrary backdating that would corrupt time series.
MAX_AGE = timedelta(days=2)
MAX_FUTURE = timedelta(minutes=5)

Scalar = Union[bool, int, float, str]


class EventIn(BaseModel):
    name: EventName
    props: dict[str, Scalar] = Field(default_factory=dict)
    occurred_at: datetime

    @field_validator("props")
    @classmethod
    def _props_are_safe(cls, v: dict[str, Scalar]) -> dict[str, Scalar]:
        if len(v) > MAX_PROPS:
            raise ValueError(f"at most {MAX_PROPS} props")
        for key, value in v.items():
            if not _KEY.match(key):
                raise ValueError(f"invalid prop key: {key!r}")
            if isinstance(value, str) and not _SLUG.match(value):
                # Free text is refused outright rather than truncated or scrubbed.
                raise ValueError(f"prop {key!r} must be a short lowercase slug")
            if isinstance(value, (int, float)) and not isinstance(value, bool) and abs(value) > 1e9:
                raise ValueError(f"prop {key!r} out of range")
        return v

    @field_validator("occurred_at")
    @classmethod
    def _occurred_in_window(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("occurred_at must include a timezone")
        now = datetime.now(timezone.utc)
        if v < now - MAX_AGE or v > now + MAX_FUTURE:
            raise ValueError("occurred_at is outside the accepted window")
        return v


class EventBatchIn(BaseModel):
    events: list[EventIn] = Field(min_length=1, max_length=MAX_BATCH)


class DailyActive(BaseModel):
    day: str
    users: int


class EventCount(BaseModel):
    name: str
    events: int
    users: int


class AnalyticsSummary(BaseModel):
    window_days: int
    total_events: int
    active_users_window: int
    dau: list[DailyActive]
    by_event: list[EventCount]
