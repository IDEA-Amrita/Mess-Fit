"""SQLAlchemy models for exercises, workout templates, and workout logs."""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import UUID, Date, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from messfit_api.db import Base


class ExerciseORM(Base):
    __tablename__ = "exercises"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # readable, e.g. 'pushup'
    name: Mapped[str] = mapped_column(Text)
    primary_muscle: Mapped[str] = mapped_column(Text)
    secondary_muscles: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    equipment: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    default_sets: Mapped[int] = mapped_column(Integer)
    default_reps: Mapped[str] = mapped_column(Text)  # "8-12" or "AMRAP"
    rest_seconds: Mapped[int] = mapped_column(Integer, server_default="60")
    youtube_video_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    instruction_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    common_mistakes: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")


class WorkoutTemplateORM(Base):
    __tablename__ = "workout_templates"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # 'bw_hostel_gain_30min'
    name: Mapped[str] = mapped_column(Text)
    goal: Mapped[str] = mapped_column(Text)
    equipment_required: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    duration_minutes: Mapped[int] = mapped_column(Integer)
    days_per_week: Mapped[int] = mapped_column(Integer)
    structure: Mapped[dict[str, Any]] = mapped_column(JSONB)


class WorkoutLogORM(Base):
    __tablename__ = "workout_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    date: Mapped[dt.date] = mapped_column(Date)
    template_id: Mapped[str] = mapped_column(
        Text, ForeignKey("workout_templates.id", ondelete="RESTRICT")
    )
    exercises_done: Mapped[list[Any]] = mapped_column(JSONB, server_default="[]")
    status: Mapped[str] = mapped_column(Text)
    skip_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "date", "template_id", name="workout_logs_unique_entry"),
    )
