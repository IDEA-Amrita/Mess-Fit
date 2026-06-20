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
