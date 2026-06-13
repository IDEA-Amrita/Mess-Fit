"""Unit tests for the vision OCR pipeline.

No network: the thin model calls (_call_gemini / _call_groq) are monkeypatched
with canned text so we can exercise fence-stripping, schema validation, and the
Gemini -> Groq fallback deterministically.
"""

from __future__ import annotations

import pytest

from messfit_api.mess import ocr
from messfit_api.mess.ocr import OcrError, parse_menu_text

_GOOD_JSON = """
{
  "weekly": [
    {"day": "Monday", "meals": [
      {"type": "breakfast", "dishes": [{"name": "Idli"}, {"name": "Sambar"}]},
      {"type": "lunch", "dishes": [{"name": "White Rice"}, {"name": "Rasam", "confidence_low": true}]}
    ]}
  ]
}
"""


# ─── parsing ──────────────────────────────────────────────────────────


def test_parses_clean_json():
    menu = parse_menu_text(_GOOD_JSON)
    assert len(menu.weekly) == 1
    day = menu.weekly[0]
    assert day.day == "Monday"
    assert day.meals[0].type == "breakfast"
    assert day.meals[0].dishes[0].name == "Idli"
    # confidence_low flows through and defaults to False otherwise.
    assert day.meals[1].dishes[1].confidence_low is True
    assert day.meals[0].dishes[0].confidence_low is False


def test_strips_markdown_fences():
    fenced = "```json\n" + _GOOD_JSON.strip() + "\n```"
    menu = parse_menu_text(fenced)
    assert menu.weekly[0].day == "Monday"


def test_clamps_trailing_prose():
    noisy = _GOOD_JSON.strip() + "\n\nThat's the full menu for the week!"
    menu = parse_menu_text(noisy)
    assert menu.weekly[0].meals[0].dishes[0].name == "Idli"


def test_non_json_raises():
    with pytest.raises(OcrError, match="non-JSON"):
        parse_menu_text("Sorry, I can't read this image.")


def test_off_schema_raises():
    # 'type' is not a valid meal type.
    bad = '{"weekly": [{"day": "Monday", "meals": [{"type": "brunch", "dishes": []}]}]}'
    with pytest.raises(OcrError, match="schema"):
        parse_menu_text(bad)


def test_empty_menu_raises():
    with pytest.raises(OcrError, match="empty"):
        parse_menu_text('{"weekly": []}')


# ─── fallback ─────────────────────────────────────────────────────────


async def test_uses_gemini_when_it_succeeds(monkeypatch):
    async def fake_gemini(image_bytes, mime):
        return _GOOD_JSON

    async def fail_groq(image_bytes, mime):
        raise AssertionError("groq must not be called when gemini succeeds")

    monkeypatch.setattr(ocr, "_call_gemini", fake_gemini)
    monkeypatch.setattr(ocr, "_call_groq", fail_groq)

    menu = await ocr.ocr_menu_image(b"fake-bytes", "image/jpeg")
    assert menu.weekly[0].day == "Monday"


async def test_falls_back_to_groq_on_gemini_failure(monkeypatch):
    async def boom_gemini(image_bytes, mime):
        raise RuntimeError("gemini 503")

    async def fake_groq(image_bytes, mime):
        return _GOOD_JSON

    monkeypatch.setattr(ocr, "_call_gemini", boom_gemini)
    monkeypatch.setattr(ocr, "_call_groq", fake_groq)

    menu = await ocr.ocr_menu_image(b"fake-bytes", "image/jpeg")
    assert menu.weekly[0].meals[0].dishes[0].name == "Idli"


async def test_falls_back_when_gemini_returns_garbage(monkeypatch):
    async def garbage_gemini(image_bytes, mime):
        return "not json at all"

    async def fake_groq(image_bytes, mime):
        return _GOOD_JSON

    monkeypatch.setattr(ocr, "_call_gemini", garbage_gemini)
    monkeypatch.setattr(ocr, "_call_groq", fake_groq)

    menu = await ocr.ocr_menu_image(b"fake-bytes", "image/jpeg")
    assert menu.weekly[0].day == "Monday"


async def test_both_fail_raises_ocr_error(monkeypatch):
    async def boom_gemini(image_bytes, mime):
        raise RuntimeError("gemini down")

    async def boom_groq(image_bytes, mime):
        raise RuntimeError("groq down")

    monkeypatch.setattr(ocr, "_call_gemini", boom_gemini)
    monkeypatch.setattr(ocr, "_call_groq", boom_groq)

    with pytest.raises(OcrError, match="both vision backends failed"):
        await ocr.ocr_menu_image(b"fake-bytes", "image/jpeg")
