"""SQLAlchemy ORM models for the profile module.

These mirror the tables created in migration 002 (see SCHEMA.md §5).
Columns marked with server-side defaults rely on Postgres to fill the
value (NOW(), gen_random_uuid(), etc.) — we don't repeat those in
Python.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    ARRAY,
    UUID,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class Profile(Base):
    __tablename__ = "profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    dob: Mapped[date] = mapped_column(Date, nullable=False)
    sex: Mapped[str] = mapped_column(Text, nullable=False)
    height_cm: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    current_weight_kg: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    target_weight_kg: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    target_rate_kg_per_week: Mapped[float] = mapped_column(
        Numeric(3, 2), nullable=False
    )
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    activity_level: Mapped[int] = mapped_column(Integer, nullable=False)
    diet_type: Mapped[str] = mapped_column(Text, nullable=False)
    allergies: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    conditions: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "sex IN ('male', 'female', 'other')", name="profiles_sex_check"
        ),
        CheckConstraint("height_cm BETWEEN 120 AND 220", name="profiles_height_check"),
        CheckConstraint(
            "current_weight_kg BETWEEN 30 AND 200",
            name="profiles_current_weight_check",
        ),
        CheckConstraint(
            "target_weight_kg BETWEEN 30 AND 200",
            name="profiles_target_weight_check",
        ),
        CheckConstraint(
            "target_rate_kg_per_week BETWEEN -0.5 AND 0.5",
            name="profiles_target_rate_check",
        ),
        CheckConstraint(
            "goal IN ('lose', 'maintain', 'gain')", name="profiles_goal_check"
        ),
        CheckConstraint(
            "activity_level BETWEEN 1 AND 5", name="profiles_activity_check"
        ),
        CheckConstraint(
            "diet_type IN ('veg', 'eggetarian', 'non_veg', 'jain')",
            name="profiles_diet_check",
        ),
    )


class HostelContext(Base):
    __tablename__ = "hostel_contexts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    mess_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID, ForeignKey("messes.id", ondelete="RESTRICT"), nullable=True
    )
    canteen_freq: Mapped[str] = mapped_column(Text, nullable=False)
    canteen_typical_spend_inr: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    top_up_budget_inr_weekly: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    equipment: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    workout_minutes_per_day: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="30"
    )
    workout_days_per_week: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="3"
    )
    gym_access_days: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "canteen_freq IN ('never', 'rare', 'frequent', 'daily')",
            name="hostel_canteen_freq_check",
        ),
    )
