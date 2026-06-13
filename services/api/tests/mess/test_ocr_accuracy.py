"""Live OCR accuracy gate: ≥85% on the labelled photo test set.

Hits the real Gemini API, so it's OPT-IN — set RUN_OCR_ACCURACY=1 to run it
(kept out of the default suite / CI, like the optimizer eval). It reads every
image in tests/fixtures/menus/ that has an entry in ground_truth.json, OCRs it,
scores against the ground truth, and asserts the mean accuracy clears the bar.

DATA DEPENDENCY: the 20 real labelled photos are a collection task (see the
fixtures README). With no fixtures present the test SKIPS — the harness is
ready; the photos are what's outstanding for the phase quality gate.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

import pytest

from messfit_api.mess.ocr import ocr_menu_image

from ._ocr_scoring import score_parsed

_FIXTURES = Path(__file__).resolve().parent.parent / "fixtures" / "menus"
_GROUND_TRUTH = _FIXTURES / "ground_truth.json"
_ACCURACY_BAR = 0.85
_MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_OCR_ACCURACY") != "1",
    reason="live OCR accuracy test — set RUN_OCR_ACCURACY=1 to run",
)


def _load_truth() -> dict:
    if not _GROUND_TRUTH.exists():
        return {}
    raw = json.loads(_GROUND_TRUTH.read_text(encoding="utf-8"))
    # Keys starting with '_' are comments/placeholders, not real fixtures.
    return {k: v for k, v in raw.items() if not k.startswith("_")}


def test_ocr_accuracy_meets_bar():
    truth = _load_truth()
    if not truth:
        pytest.skip("no ground_truth.json entries — add labelled photos first")

    results = []
    for filename, expected in truth.items():
        path = _FIXTURES / filename
        if not path.exists():
            pytest.skip(f"fixture image missing: {filename}")
        mime = _MIME.get(path.suffix.lower(), "image/jpeg")
        parsed = asyncio.run(ocr_menu_image(path.read_bytes(), mime))
        res = score_parsed(parsed, expected)
        results.append((filename, res))
        print(f"{filename}: {res.accuracy:.0%} ({res.correct}/{res.total}); misses={res.misses}")

    overall_total = sum(r.total for _, r in results)
    overall_correct = sum(r.correct for _, r in results)
    accuracy = overall_correct / overall_total if overall_total else 0.0
    print(f"\nOVERALL: {accuracy:.1%} ({overall_correct}/{overall_total}) across {len(results)} photos")

    assert accuracy >= _ACCURACY_BAR, (
        f"OCR accuracy {accuracy:.1%} below {_ACCURACY_BAR:.0%} bar"
    )
