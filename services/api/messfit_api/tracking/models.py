"""SQLAlchemy models for meal, weight, and subjective logs (Phase 6).

workout_logs lives in ``workouts/models.py`` (created in migration 008) and is
reused here for progress reads.
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import UUID, Date, ForeignKey, Integer, Numeric, Text, func
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from messfit_api.db import Base


class MealLogORM(Base):
    __tablename__ = "meal_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    date: Mapped[dt.date] = mapped_column(Date)
    meal_type: Mapped[str] = mapped_column(Text)  # breakfast|lunch|snack|dinner
    status: Mapped[str] = mapped_column(Text)  # as_planned|different|skipped
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # V2

    # Macro snapshot of the planned meal — client-supplied when as_planned.
    kcal: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    protein_g: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    carbs_g: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    fats_g: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )


class WeightLogORM(Base):
    __tablename__ = "weight_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    date: Mapped[dt.date] = mapped_column(Date, primary_key=True)
    weight_kg: Mapped[float] = mapped_column(Numeric(5, 2))
    created_at: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )


class SubjectiveLogORM(Base):
    __tablename__ = "subjective_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    date: Mapped[dt.date] = mapped_column(Date, primary_key=True)
    energy: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hunger: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mood: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )
