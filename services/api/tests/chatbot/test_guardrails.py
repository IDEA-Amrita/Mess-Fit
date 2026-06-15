"""Pure guardrail tests for the LLM layer (Phase 7, task 7.4). No network."""

from __future__ import annotations

import pytest

from messfit_api.chatbot.llm import is_medical, validate_citations

# ─── medical refusal ──────────────────────────────────────────────────


@pytest.mark.parametrize(
    "q",
    [
        "What dose of metformin should I take?",
        "How much insulin do I need?",
        "Should I increase my thyroxine medication?",
        "Can you diagnose my stomach pain?",
        "How to treat my fever?",
        "What can cure my acne?",
        "Prescribe me something for cramps",
        "Take 500 mg twice a day?",
    ],
)
def test_medical_queries_refused(q: str):
    assert is_medical(q) is True


@pytest.mark.parametrize(
    "q",
    [
        "How much protein do I need to build muscle?",
        "What are cheap protein sources in India?",
        "Best chest exercise without equipment?",
        "How do I bulk on a hostel mess?",
        "Is creatine safe to take?",
    ],
)
def test_normal_queries_allowed(q: str):
    assert is_medical(q) is False


# ─── citation validation ──────────────────────────────────────────────


def test_strips_out_of_range_citations():
    text = "Eggs are cheap protein [Source 1]. Also see [Source 7] and [Source 2]."
    # Only 2 sources were provided → [Source 7] must be stripped.
    out = validate_citations(text, n_sources=2)
    assert "[Source 1]" in out
    assert "[Source 2]" in out
    assert "[Source 7]" not in out


def test_keeps_valid_citations_unchanged():
    text = "Protein matters [Source 1] and so does sleep [Source 3]."
    out = validate_citations(text, n_sources=3)
    assert "[Source 1]" in out and "[Source 3]" in out


def test_no_citations_is_noop():
    text = "Just a plain sentence with no citations."
    assert validate_citations(text, n_sources=3) == text
