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
    # Required: an unlabelled dish must never be treated as vegetarian.
    diet_type: Literal["vegan", "veg", "egg", "non_veg"]
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


# ─── Crowdsourcing (D25) ───────────────────────────────────────────────


class DishFeedbackIn(BaseModel):
    """User confirms or denies a dish is being served today."""

    date: date
    meal_type: Literal["breakfast", "lunch", "snack", "dinner"]
    dish_id: uuid.UUID
    vote: Literal["confirm", "deny"]


class DishFeedbackOut(BaseModel):
    dish_id: uuid.UUID
    confirms: int = 0
    denies: int = 0


# ─── OCR (Phase 4) ────────────────────────────────────────────────────

MealTypeLiteral = Literal["breakfast", "lunch", "snack", "dinner"]
OcrStatus = Literal["pending", "processing", "ready_for_review", "approved", "rejected", "failed"]


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


# DB CHECK-constrained vocabularies (migration 004/006) — Literals so an
# off-enum LLM estimate fails validation and falls back to a safe default.
DishCategory = Literal[
    "rice",
    "roti",
    "curry",
    "sabzi",
    "dal",
    "snack",
    "sweet",
    "beverage",
    "protein",
    "salad",
    "other",
]
PortionIcon = Literal[
    "katori",
    "small_katori",
    "fist",
    "palm",
    "thumb",
    "cupped_hand",
    "plate_quarter",
    "piece",
    "glass",
]
DietTypeLiteral = Literal["vegan", "veg", "egg", "non_veg"]


class NutritionEstimate(BaseModel):
    """Gemini-estimated nutrition for an unmatched dish, created as a draft
    (confidence='estimated') at approve time and queued for verification."""

    category: DishCategory = "other"
    default_serving_unit: str = "katori"
    default_serving_grams: float = Field(default=150, gt=0)
    kcal: float = Field(default=150, ge=0)
    protein_g: float = Field(default=4, ge=0)
    carbs_g: float = Field(default=25, ge=0)
    fats_g: float = Field(default=4, ge=0)
    # When the model omits it, assume the strictest class: the dish is then only
    # offered to users who eat everything until an admin corrects it.
    diet_type: DietTypeLiteral = "non_veg"
    portion_icon: PortionIcon = "katori"
    # Best-effort LLM guess, not verified — confidence stays 'estimated' until
    # an admin reviews it via PATCH /mess/admin/dishes/{id}.
    allergens: list[str] = Field(default_factory=list)


class DishUpdate(BaseModel):
    """Partial update for an existing dish. All fields optional (PATCH
    semantics) — only the fields an admin actually sends are changed.

    Exists specifically so allergens/diet_type on a draft dish created from
    OCR or a photo scan can be corrected after the fact; there was previously
    no way to edit a dish once created.
    """

    name: str | None = None
    name_local: dict[str, Any] | None = None
    category: DishCategory | None = None
    diet_type: DietTypeLiteral | None = None
    default_serving_unit: str | None = None
    default_serving_grams: float | None = None
    kcal: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fats_g: float | None = None
    fiber_g: float | None = None
    sodium_mg: float | None = None
    glycemic_index: int | None = None
    allergens: list[str] | None = None
    tags: list[str] | None = None
    portion_icon: PortionIcon | None = None
    confidence: str | None = None


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
