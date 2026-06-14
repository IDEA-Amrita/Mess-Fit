"""Pydantic schemas for the logging + progress API."""

from __future__ import annotations

import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# ─── meal ────────────────────────────────────────────────────────────────


class MealLogIn(BaseModel):
    date: datetime.date
    meal_type: Literal["breakfast", "lunch", "snack", "dinner"]
    status: Literal["as_planned", "different", "skipped"]
    notes: str | None = None
    # Macro snapshot of the planned meal — sent by the client when as_planned.
    kcal: float | None = Field(default=None, ge=0)
    protein_g: float | None = Field(default=None, ge=0)
    carbs_g: float | None = Field(default=None, ge=0)
    fats_g: float | None = Field(default=None, ge=0)


class MealLogOut(BaseModel):
    id: Any
    date: datetime.date
    meal_type: str
    status: str
    notes: str | None
    kcal: float | None
    protein_g: float | None
    carbs_g: float | None
    fats_g: float | None

    model_config = ConfigDict(from_attributes=True)


# ─── weight ──────────────────────────────────────────────────────────────


class WeightLogIn(BaseModel):
    date: datetime.date
    weight_kg: float = Field(ge=30, le=200)


class WeightLogOut(BaseModel):
    date: datetime.date
    weight_kg: float

    model_config = ConfigDict(from_attributes=True)


# ─── subjective ──────────────────────────────────────────────────────────


class SubjectiveLogIn(BaseModel):
    date: datetime.date
    energy: int | None = Field(default=None, ge=1, le=5)
    hunger: int | None = Field(default=None, ge=1, le=5)
    mood: int | None = Field(default=None, ge=1, le=5)


class SubjectiveLogOut(BaseModel):
    date: datetime.date
    energy: int | None
    hunger: int | None
    mood: int | None

    model_config = ConfigDict(from_attributes=True)


# ─── today (prefill) ───────────────────────────────────────────────────────


class TodayLogs(BaseModel):
    date: datetime.date
    meals: list[MealLogOut]
    weight: WeightLogOut | None
    subjective: SubjectiveLogOut | None
    workout_status: str | None  # done | partial | skipped, if logged today


# ─── progress ──────────────────────────────────────────────────────────────


class WeightPoint(BaseModel):
    date: datetime.date
    weight_kg: float

    model_config = ConfigDict(from_attributes=True)


class Progress(BaseModel):
    range: str
    weight_series: list[WeightPoint]
    adherence_rate: float
    macro_hit_rate: float | None
    projection: dict[str, Any]
    streak_days: int
