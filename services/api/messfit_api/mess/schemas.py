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


# ─── OCR (Phase 4) ────────────────────────────────────────────────────

MealTypeLiteral = Literal["breakfast", "lunch", "snack", "dinner"]
OcrStatus = Literal[
    "pending", "processing", "ready_for_review", "approved", "rejected", "failed"
]


class ParsedDish(BaseModel):
    """One dish as the vision model read it off the menu board."""

    name: str
    # The model flags cells it wasn't sure about; the review UI highlights these.
    confidence_low: bool = False


class ParsedMeal(BaseModel):
    type: MealTypeLiteral
    dishes: list[ParsedDish] = Field(default_factory=list)


class ParsedDay(BaseModel):
    # Day name as printed ("Monday"); the approve step maps it to 0-6.
    day: str
    meals: list[ParsedMeal] = Field(default_factory=list)


class ParsedMenu(BaseModel):
    """The structured weekly menu the vision model returns. The strict shape
    the LLM output is validated against — anything off-schema fails parsing."""

    weekly: list[ParsedDay] = Field(default_factory=list)


class DishMatch(BaseModel):
    """A fuzzy-match candidate for a parsed dish name against the catalog."""

    dish_id: uuid.UUID
    name: str
    score: float  # 0.0–1.0; higher is closer


class ReviewedDish(BaseModel):
    """A dish in the admin-reviewed menu at approve time.

    ``dish_id`` set ⇒ matched to an existing catalog dish. ``dish_id`` null ⇒
    a new dish to create as a draft (Gemini-estimated nutrition, confidence
    'estimated') before linking into mess_menus.
    """

    name: str
    dish_id: uuid.UUID | None = None


class ReviewedMeal(BaseModel):
    type: MealTypeLiteral
    dishes: list[ReviewedDish] = Field(default_factory=list)


class ReviewedDay(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    meals: list[ReviewedMeal] = Field(default_factory=list)


class OcrApproveIn(BaseModel):
    """Body for approving an OCR job into mess_menus."""

    effective_from: date
    weekly: list[ReviewedDay] = Field(default_factory=list)


class OcrJobOut(BaseModel):
    id: uuid.UUID
    mess_id: uuid.UUID
    status: OcrStatus
    parsed_result: dict[str, Any] | None = None
    error_message: str | None = None
    # Short-lived signed URL for the review UI; minted on read, not stored.
    image_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class OcrJobSummary(BaseModel):
    """Lighter shape for the job list (no parsed_result blob)."""

    id: uuid.UUID
    mess_id: uuid.UUID
    status: OcrStatus
    error_message: str | None = None

    model_config = ConfigDict(from_attributes=True)
