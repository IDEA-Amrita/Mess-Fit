"""Pydantic schemas for the profile module.

These describe the shape of data flowing in/out of the API — they act
as a runtime guard for request bodies and as type hints for response
bodies. The DB-level CHECK constraints in migration 002 enforce the
same rules; keeping them in sync is mandatory.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─── enums (kept as Literal for Pydantic-friendly typing) ───────────────
DietType = Literal["veg", "eggetarian", "non_veg", "jain"]
Goal = Literal["lose", "maintain", "gain"]
Sex = Literal["male", "female", "other"]
CanteenFreq = Literal["never", "rare", "frequent", "daily"]
Equipment = Literal["bodyweight", "bands", "college_gym", "home_gym"]
DayOfWeek = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# Allergens and conditions are open-ended in V1 (validated as plain
# strings here; we narrow at the UI layer). Keeping the canonical lists
# here as documentation.
ALLOWED_ALLERGIES = {
    "lactose",
    "gluten",
    "nuts",
    "soy",
    "eggs",
    "seafood",
    "mustard",
    "sesame",
}
ALLOWED_CONDITIONS = {
    "diabetes",
    "hypertension",
    "pcos",
    "ibs",
    "gerd",
    "anemia",
    "hypothyroid",
}


# ─── profile ────────────────────────────────────────────────────────────
class ProfileIn(BaseModel):
    """Request body for upserting the current user's profile."""

    dob: date
    sex: Sex
    height_cm: float = Field(ge=120, le=220)
    current_weight_kg: float = Field(ge=30, le=200)
    target_weight_kg: float = Field(ge=30, le=200)
    target_rate_kg_per_week: float = Field(ge=-0.5, le=0.5)
    goal: Goal
    activity_level: int = Field(ge=1, le=5)
    diet_type: DietType
    allergies: list[str] = Field(default_factory=list)
    conditions: list[str] = Field(default_factory=list)


class ProfileOut(ProfileIn):
    """Response body when reading the current user's profile."""

    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── hostel context ─────────────────────────────────────────────────────
class HostelContextIn(BaseModel):
    """Request body for upserting the current user's hostel context."""

    mess_id: UUID | None = None
    canteen_freq: CanteenFreq
    canteen_typical_spend_inr: int = Field(ge=0, default=0)
    top_up_budget_inr_weekly: int = Field(ge=0, default=0)
    equipment: list[Equipment] = Field(default_factory=list)
    workout_minutes_per_day: int = Field(ge=0, le=180, default=30)
    workout_days_per_week: int = Field(ge=0, le=7, default=3)
    gym_access_days: list[DayOfWeek] = Field(default_factory=list)


class HostelContextOut(HostelContextIn):
    """Response body when reading the current user's hostel context."""

    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
