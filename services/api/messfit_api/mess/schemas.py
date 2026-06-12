from datetime import date
from typing import Any, Literal
import uuid

from pydantic import BaseModel, Field, ConfigDict


class MessBase(BaseModel):
    name: str
    college: str
    city: str


class MessResponse(MessBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


class DishBase(BaseModel):
    name: str
    name_local: dict[str, Any] = Field(default_factory=dict)
    category: str
    diet_type: Literal["vegan", "veg", "egg", "non_veg"] = "veg"
    default_serving_unit: str
    default_serving_grams: float
    kcal: float
    protein_g: float
    carbs_g: float
    fats_g: float
    fiber_g: float = 0.0
    sodium_mg: float = 0.0
    glycemic_index: int | None = None
    allergens: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    portion_icon: str = "katori"
    confidence: str = "estimated"
    source: str | None = None


class DishResponse(DishBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


class MessMenuBase(BaseModel):
    mess_id: uuid.UUID
    effective_from: date
    effective_to: date | None = None
    day_of_week: int
    meal_type: str
    dish_id: uuid.UUID
    availability: str = "usually"


class MessMenuResponse(MessMenuBase):
    id: uuid.UUID
    dish: DishResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class DailyMenuResponse(BaseModel):
    date: date
    day_of_week: int
    breakfast: list[MessMenuResponse]
    lunch: list[MessMenuResponse]
    snack: list[MessMenuResponse]
    dinner: list[MessMenuResponse]


class DishExclusionIn(BaseModel):
    date: date
    meal_type: str
    dish_id: uuid.UUID


class DishExclusionOut(DishExclusionIn):
    model_config = ConfigDict(from_attributes=True)
