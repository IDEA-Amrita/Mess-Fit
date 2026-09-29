"""Vision-based meal logging: plate photo → macro estimation.

Uses Gemini 2.0 Flash's multimodal capabilities to identify Indian mess food
from a user's photo and return structured macro estimates. The prompt is
carefully tuned for Indian hostel/mess dishes (idli, sambar, poha, etc.)
with portion sizes expressed in familiar serving units (katori, piece, glass).

This module is deliberately separated from the OCR pipeline (which processes
admin-uploaded weekly menu photos). Here we handle *user-facing* single-plate
photos for logging.
"""

from __future__ import annotations

import json
import structlog
from dataclasses import dataclass
from typing import Any

from ..config import settings

logger = structlog.get_logger(__name__)

GEMINI_MODEL = "gemini-2.0-flash"

_MEAL_PHOTO_PROMPT = """\
You are a nutrition expert specializing in Indian mess/canteen food.
Analyze this photo of a meal plate and identify each dish visible.

For each dish, estimate:
- name: the common name of the dish
- portion: estimated serving size (e.g., "1 katori", "2 pieces", "1 glass")
- kcal: calories for that portion
- protein_g: grams of protein
- carbs_g: grams of carbohydrates
- fats_g: grams of fat

Return ONLY valid JSON in this exact format:
{
  "dishes": [
    {
      "name": "Idli",
      "portion": "2 pieces",
      "kcal": 130,
      "protein_g": 4,
      "carbs_g": 26,
      "fats_g": 1
    }
  ],
  "total_kcal": 130,
  "total_protein_g": 4,
  "total_carbs_g": 26,
  "total_fats_g": 1,
  "confidence": "high"
}

confidence should be "high", "medium", or "low" depending on how clearly you
can identify the dishes and estimate portions.

No markdown, no commentary — ONLY valid JSON.
"""


@dataclass(frozen=True)
class PhotoMealEstimate:
    """Structured estimate from a plate photo."""

    dishes: list[dict[str, Any]]
    total_kcal: float
    total_protein_g: float
    total_carbs_g: float
    total_fats_g: float
    confidence: str  # high | medium | low


def _strip_fences(raw: str) -> str:
    """Remove markdown code fences and isolate the JSON object."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1] if text.count("```") >= 2 else text.strip("`")
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
    return text.strip()


async def estimate_meal_from_photo(
    image_bytes: bytes, mime: str = "image/jpeg"
) -> PhotoMealEstimate:
    """Analyze a meal photo and return estimated macros.

    Falls back to a conservative "unknown meal" estimate if the vision
    model fails or returns unparseable output — never blocks the user
    from logging.
    """
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime),
                _MEAL_PHOTO_PROMPT,
            ],
        )
        raw = response.text or ""
        cleaned = _strip_fences(raw)
        data = json.loads(cleaned)

        return PhotoMealEstimate(
            dishes=data.get("dishes", []),
            total_kcal=float(data.get("total_kcal", 0)),
            total_protein_g=float(data.get("total_protein_g", 0)),
            total_carbs_g=float(data.get("total_carbs_g", 0)),
            total_fats_g=float(data.get("total_fats_g", 0)),
            confidence=data.get("confidence", "low"),
        )
    except Exception as e:
        logger.warning("Photo meal estimation failed", error=str(e))
        # Return a safe fallback so logging is never blocked.
        return PhotoMealEstimate(
            dishes=[{"name": "Unidentified meal", "portion": "1 plate"}],
            total_kcal=400,
            total_protein_g=12,
            total_carbs_g=60,
            total_fats_g=10,
            confidence="low",
        )

from pydantic import BaseModel, Field, model_validator
from typing import Literal

# --- Production Validation Models ---
class ExtractedDish(BaseModel):
    name: str = Field(..., description="Name of the food item")
    category: str = Field(..., description="One of: protein, rice, roti, curry, sweet, snack, beverage, other")
    # Defaults to the strictest class so a dish the model couldn't classify is
    # never offered to a vegetarian.
    diet_type: Literal["vegan", "veg", "egg", "non_veg"] = Field(
        "non_veg",
        description="vegan, veg, egg (contains egg) or non_veg (meat/fish); non_veg when unsure",
    )
    portion_icon: Literal["piece", "katori", "small_katori", "glass", "spoon", "thumb"] = Field("piece")
    serving_grams: float = Field(..., ge=1, le=1000, description="Estimated grams per serving")
    kcal: float = Field(..., ge=0, le=2000, description="Calories per serving")
    protein_g: float = Field(..., ge=0, le=200, description="Protein in grams")
    carbs_g: float = Field(..., ge=0, le=300, description="Carbs in grams")
    fats_g: float = Field(..., ge=0, le=200, description="Fats in grams")
    # Best-effort LLM guess from a single photo, never admin-reviewed (this
    # endpoint returns a plate synchronously) — see optimize_photo's warning.
    allergens: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_macros(self):
        # A single macro cannot weigh more than the serving itself
        if self.protein_g > self.serving_grams:
            self.protein_g = self.serving_grams
        if self.carbs_g > self.serving_grams:
            self.carbs_g = self.serving_grams
        if self.fats_g > self.serving_grams:
            self.fats_g = self.serving_grams
        return self

class MenuExtractionResult(BaseModel):
    dishes: list[ExtractedDish] = Field(..., description="List of all unique food items available")

_MENU_PHOTO_PROMPT = """
You are a highly precise nutrition AI. Analyze this image of a restaurant menu, buffet spread, or food selection.
Identify EVERY distinct food item available.
For each item, estimate its macro-nutritional profile for a standard single serving.
Do not hallucinate impossible calorie counts (e.g. 50,000). Keep estimates realistic for human consumption.

For each item, also flag "allergens": zero or more of [eggs,gluten,lactose,mustard,nuts,soy]
that the dish plausibly contains as typically prepared (e.g. a fried item likely
containing egg batter -> ["eggs"], a wheat-based flatbread -> ["gluten"]).
This is the ONLY signal used to keep an allergic user's plate safe, so include an
allergen whenever it is plausible from the visual, not only when certain. Leave the
array empty only when none of these apply.

For each item, set "diet_type" to exactly one of vegan, veg, egg, non_veg: "egg" if it
contains egg, "non_veg" if it contains meat or fish. A vegetarian user relies on this
label, so if you are not sure an item is vegetarian, use "non_veg".
"""

async def extract_menu_from_photo(
    image_bytes: bytes, mime: str = "image/jpeg"
) -> MenuExtractionResult:
    """Production-grade menu extraction using Gemini Structured Outputs."""
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime),
                _MENU_PHOTO_PROMPT,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=MenuExtractionResult,
                temperature=0.1, # Low temperature for more deterministic/factual macro estimation
            )
        )
        
        # The Gemini SDK returns JSON strings when using response_schema. We parse it into our Pydantic model.
        if response.text:
            data = json.loads(response.text)
            return MenuExtractionResult.model_validate(data)
        
        raise ValueError("Empty response from Vision model")
    except Exception as e:
        logger.error("Menu extraction failed", error=str(e))
        # Hard fail for the optimizer rather than returning garbage data that breaks the MILP solver
        raise ValueError(f"Could not parse menu from image: {str(e)}")
