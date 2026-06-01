"""SQLAlchemy models for messes, dishes, and mess_menus."""

from __future__ import annotations

import uuid
from typing import Any

import datetime as dt

from sqlalchemy import (
    UUID,
    Date,
    Integer,
    Numeric,
    Text,
    ForeignKey,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from messfit_api.db import Base


class MessORM(Base):
    __tablename__ = "messes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text)
    college: Mapped[str] = mapped_column(Text)
    city: Mapped[str] = mapped_column(Text)
    seeded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (UniqueConstraint("college", "name", name="messes_college_name_unique"),)

    menus: Mapped[list["MessMenuORM"]] = relationship("MessMenuORM", back_populates="mess")


class DishORM(Base):
    __tablename__ = "dishes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text)
    name_local: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default='{}')
    category: Mapped[str] = mapped_column(Text)
    default_serving_unit: Mapped[str] = mapped_column(Text)
    default_serving_grams: Mapped[float] = mapped_column(Numeric(6, 2))
    kcal: Mapped[float] = mapped_column(Numeric(6, 2))
    protein_g: Mapped[float] = mapped_column(Numeric(5, 2))
    carbs_g: Mapped[float] = mapped_column(Numeric(5, 2))
    fats_g: Mapped[float] = mapped_column(Numeric(5, 2))
    fiber_g: Mapped[float] = mapped_column(Numeric(5, 2), server_default="0")
    sodium_mg: Mapped[float] = mapped_column(Numeric(6, 2), server_default="0")
    glycemic_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    allergens: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default='{}')
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default='{}')
    portion_icon: Mapped[str] = mapped_column(Text, server_default="katori")
    confidence: Mapped[str] = mapped_column(Text, server_default="estimated")
    source: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("name", "default_serving_unit", name="dishes_name_unit_unique"),)


class MessMenuORM(Base):
    __tablename__ = "mess_menus"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mess_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("messes.id", ondelete="CASCADE"))
    effective_from: Mapped[dt.date] = mapped_column(Date)
    effective_to: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    day_of_week: Mapped[int] = mapped_column(Integer)
    meal_type: Mapped[str] = mapped_column(Text)
    dish_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("dishes.id", ondelete="RESTRICT"))
    availability: Mapped[str] = mapped_column(Text, server_default="usually")

    __table_args__ = (UniqueConstraint("mess_id", "effective_from", "day_of_week", "meal_type", "dish_id", name="mess_menus_unique_entry"),)

    mess: Mapped["MessORM"] = relationship("MessORM", back_populates="menus")
    dish: Mapped["DishORM"] = relationship("DishORM")


class DishExclusionORM(Base):
    """Per-user, per-date, per-meal dish exclusions.

    When a user marks a dish as 'not available today', a row is inserted here.
    The Phase 3 optimizer reads this table to filter dishes before solving.
    """

    __tablename__ = "dish_exclusions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    date: Mapped[dt.date] = mapped_column(Date, primary_key=True)
    meal_type: Mapped[str] = mapped_column(Text, primary_key=True)
    dish_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dishes.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now()
    )
