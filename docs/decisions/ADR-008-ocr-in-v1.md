# ADR-008: Bringing OCR into V1 (lifted from V2)

| | |
|---|---|
| **Date** | 2026-05-15 |
| **Status** | Proposed |
| **Decider(s)** | @kavinesh, @teammate |
| **Related** | |

---

## Context

The original PRD scoped OCR (extracting items from a photographed mess
menu) into V2. After user interviews, the biggest manual-entry pain
point is the weekly menu input — mess wardens hand-print or post a
photo, and students transcribing it kills the daily-use flywheel.

## Decision

Pull OCR into V1. Pipeline:

1. Student / warden uploads a menu photo
2. Worker job runs OCR (Tesseract for first pass; Gemini Vision as fallback for low-confidence regions)
3. Parsed items go into a draft `week_menu` row for human review
4. After review the row becomes the canonical menu for the week

## Consequences

### Positive
- Removes the highest-friction manual step from the weekly loop
- Differentiates from a notebook / spreadsheet UX

### Negative
- ~1 week of additional scope in Phase 2 / 3
- Two model dependencies (Tesseract + Gemini) — Gemini quota cost

### Neutral
- Adds an admin-review surface we'd have built later anyway

## Alternatives considered

### Alternative 1: Defer to V2, manual entry in V1
**Pros:** Smaller V1 surface.
**Cons:** Manual entry was the dominant complaint in user interviews.
**Why rejected:** Loses the daily-use flywheel.

### Alternative 2: Gemini Vision only (skip Tesseract)
**Pros:** Simpler.
**Cons:** Every photo hits paid quota; offline/dev story is worse.
**Why rejected:** Hybrid keeps costs predictable.

## Revisit when
- Gemini quota cost exceeds budget
- OCR accuracy is low enough that human review > manual entry on time
