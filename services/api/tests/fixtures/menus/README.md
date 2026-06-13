# OCR accuracy test set

The Phase 4 quality gate is **≥85% OCR accuracy** (dish-name match × correct
day-meal placement) on a set of ~20 real mess-menu photos. This directory holds
that set plus its hand-labelled ground truth.

## Layout
- `*.jpg` / `*.png` / `*.webp` — photos of real printed mess menu boards.
- `ground_truth.json` — maps each image filename to the correct weekly menu.
  Keys starting with `_` are ignored (comments/examples).

## Ground-truth format
```json
{
  "monday_menu.jpg": {
    "weekly": [
      {
        "day": "Monday",
        "meals": [
          { "type": "breakfast", "dishes": ["Idli", "Sambar"] },
          { "type": "lunch", "dishes": ["White Rice", "Rasam"] }
        ]
      }
    ]
  }
}
```
`type` is one of breakfast/lunch/snack/dinner. List dishes exactly as a human
reads them off the board (the scorer tolerates minor spelling drift).

## Running the gate
The accuracy test hits the live Gemini API, so it's opt-in:
```bash
RUN_OCR_ACCURACY=1 uv run pytest tests/mess/test_ocr_accuracy.py -s
```
With no labelled photos present it skips. **Collecting the ~20 photos is an
outstanding data task** (analogous to the optimizer's nutritionist grading) —
the harness and scorer are ready; drop photos here, label them, and run.
