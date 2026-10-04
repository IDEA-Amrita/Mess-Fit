"""Vision OCR pipeline: menu photo -> structured ``ParsedMenu``.

Primary model is Gemini 2.0 Flash (multimodal). On any failure — API error,
timeout, or output that doesn't validate — we fall back to Groq's Llama 3.2
Vision. If both fail, a typed :class:`OcrError` is raised so the worker can
mark the job ``failed`` with a clear message instead of crashing.

The model calls (``_call_gemini`` / ``_call_groq``) are deliberately thin and
separate from parsing so unit tests can monkeypatch them with canned text and
exercise the fence-stripping, validation, and fallback logic with no network.
"""

from __future__ import annotations

import base64
import json
import structlog

from ..config import settings
from .schemas import NutritionEstimate, ParsedMenu

logger = structlog.get_logger(__name__)

GEMINI_MODEL = "gemini-2.0-flash"
# Groq's llama-3.2-*-vision-preview models were decommissioned; Llama 4 Scout
# is the current multimodal model on Groq (verified against the live models list).
GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

_PROMPT = """\
Extract this Indian college mess menu into structured JSON.

Schema (return EXACTLY this shape):
{
  "weekly": [
    {
      "day": "Monday",
      "meals": [
        { "type": "breakfast", "dishes": [ { "name": "Idli" }, { "name": "Sambar" } ] }
      ]
    }
  ]
}

Rules:
- "type" MUST be one of: breakfast, lunch, snack, dinner.
- Use the exact dish names printed on the menu, one object per dish.
- If a dish name is smudged, ambiguous, or you are unsure, add
  "confidence_low": true to that dish object.
- Include only days/meals actually present in the image.
- Return ONLY valid JSON. No markdown code fences, no commentary.
"""


class OcrError(RuntimeError):
    """Raised when every vision backend fails to produce a valid menu."""


# ─── thin model calls (mockable) ──────────────────────────────────────


async def _call_gemini(image_bytes: bytes, mime: str) -> str:
    """Return raw text from Gemini for the menu image."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    response = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime),
            _PROMPT,
        ],
    )
    return response.text or ""


async def _call_groq(image_bytes: bytes, mime: str) -> str:
    """Return raw text from Groq Llama Vision for the menu image."""
    from groq import AsyncGroq

    client = AsyncGroq(api_key=settings.groq_api_key)
    b64 = base64.b64encode(image_bytes).decode()
    response = await client.chat.completions.create(
        model=GROQ_VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": _PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"},
                    },
                ],
            }
        ],
        temperature=0,
    )
    return response.choices[0].message.content or ""


# ─── parsing ──────────────────────────────────────────────────────────


def _strip_fences(raw: str) -> str:
    """Remove markdown code fences and isolate the JSON object.

    Models often wrap JSON in ```json ... ``` despite instructions. We also
    clamp to the outermost braces so trailing prose can't break json.loads.
    """
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1] if text.count("```") >= 2 else text.strip("`")
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
    return text.strip()


def parse_menu_text(raw: str) -> ParsedMenu:
    """Parse + validate raw model text into a ParsedMenu, or raise OcrError."""
    cleaned = _strip_fences(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise OcrError(f"model returned non-JSON output: {e}") from e
    try:
        menu = ParsedMenu.model_validate(data)
    except Exception as e:  # pydantic ValidationError
        raise OcrError(f"model output did not match menu schema: {e}") from e
    if not menu.weekly:
        raise OcrError("model returned an empty menu")
    return menu


# ─── public API ───────────────────────────────────────────────────────


async def ocr_menu_image(image_bytes: bytes, mime: str = "image/jpeg") -> ParsedMenu:
    """Extract a structured menu from a photo. Gemini first, Groq fallback."""
    try:
        return parse_menu_text(await _call_gemini(image_bytes, mime))
    except Exception as gemini_err:
        logger.warning("Gemini OCR failed, falling back to Groq: %s", gemini_err)
        try:
            return parse_menu_text(await _call_groq(image_bytes, mime))
        except Exception as groq_err:
            raise OcrError(
                f"both vision backends failed — gemini: {gemini_err}; groq: {groq_err}"
            ) from groq_err


# ─── draft-dish nutrition estimate ────────────────────────────────────

_NUTRITION_PROMPT = """\
Estimate per-serving nutrition for the Indian dish "{name}". Return ONLY JSON:
{{"category": one of [rice,roti,curry,sabzi,dal,snack,sweet,beverage,protein,salad,other],
  "default_serving_unit": e.g. "katori"|"piece"|"glass",
  "default_serving_grams": number,
  "kcal": number, "protein_g": number, "carbs_g": number, "fats_g": number,
  "diet_type": one of [vegan,veg,egg,non_veg] — "egg" if it contains egg,
    "non_veg" if it contains meat or fish, and "non_veg" whenever unsure,
  "portion_icon": one of [katori,small_katori,fist,palm,thumb,cupped_hand,plate_quarter,piece,glass],
  "allergens": array, zero or more of [eggs,gluten,lactose,mustard,nuts,soy] —
    common allergens this dish plausibly contains as typically prepared,
    e.g. Egg Roast -> ["eggs"], Chapati -> ["gluten"], Curd -> ["lactose"].
    Empty array if none of these apply.}}
Values are for one typical serving. This estimate is unverified — an admin
reviews it before it reaches any student with a declared allergy, so include
an allergen whenever it's plausible rather than only when certain.
No markdown, no commentary."""


async def _call_gemini_text(prompt: str) -> str:
    from google import genai

    client = genai.Client(api_key=settings.gemini_api_key)
    response = await client.aio.models.generate_content(model=GEMINI_MODEL, contents=[prompt])
    return response.text or ""


async def estimate_dish_nutrition(name: str) -> NutritionEstimate:
    """Best-effort per-serving nutrition for an unmatched dish.

    Always returns a usable estimate: on any LLM/parse/validation failure we
    fall back to NutritionEstimate's conservative defaults rather than block
    the approve flow or write a zero-kcal dish. Either way the dish is created
    with confidence='estimated' and queued for verification.
    """
    try:
        raw = await _call_gemini_text(_NUTRITION_PROMPT.format(name=name))
        data = json.loads(_strip_fences(raw))
        return NutritionEstimate.model_validate(data)
    except Exception as e:
        logger.warning("nutrition estimate for %r failed, using defaults: %s", name, e)
        return NutritionEstimate()
