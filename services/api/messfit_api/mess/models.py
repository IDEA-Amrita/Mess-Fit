"""SQLAlchemy models for messes, dishes, and mess_menus."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

from sqlalchemy import (
    UUID,
    Date,
    Integer,
    Numeric,
    Text,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
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
    effective_from: Mapped[datetime.date] = mapped_column(Date)
    effective_to: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    day_of_week: Mapped[int] = mapped_column(Integer)
    meal_type: Mapped[str] = mapped_column(Text)
    dish_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("dishes.id", ondelete="RESTRICT"))
    availability: Mapped[str] = mapped_column(Text, server_default="usually")

    __table_args__ = (UniqueConstraint("mess_id", "effective_from", "day_of_week", "meal_type", "dish_id", name="mess_menus_unique_entry"),)

    mess: Mapped["MessORM"] = relationship("MessORM", back_populates="menus")
    dish: Mapped["DishORM"] = relationship("DishORM")
