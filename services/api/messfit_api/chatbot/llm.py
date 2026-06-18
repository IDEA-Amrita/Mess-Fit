"""LLM answer generation with guardrails.

Streams a grounded answer from Gemini (Groq non-stream fallback), after a
pre-flight medical-advice refusal. Pure helpers (`is_medical`,
`validate_citations`, `build_messages`) are separated from the network call so
guardrails can be unit-tested with no API access.
"""

from __future__ import annotations

import logging
import re
from collections.abc import AsyncIterator
from functools import lru_cache

from ..config import settings
from .retrieval import RetrievedChunk

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.0-flash"
GROQ_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """\
You are MessFit's nutrition and fitness assistant for Indian college students. Give \
practical advice grounded in the provided sources.

Rules you MUST follow:
1. NEVER give medical advice. If a question is about diagnosing a condition, dosing \
medication, or specific treatment, refuse and tell the user to consult a doctor.
2. Cite sources for factual claims using [Source N] matching the provided context. \
Only cite source numbers that exist in the context.
3. Refuse questions about extreme diets, eating-disorder behaviours, or dangerous \
weight-loss tricks; redirect to healthy approaches.
4. For supplements, only general guidance on whey, creatine, and multivitamins is OK; \
refer to a doctor for anything else. Never recommend drug doses.
5. Use the user's profile (in context) to personalise answers.
6. Keep responses concise — 3-5 sentences typical, longer only when explicitly asked.
"""

MEDICAL_REFUSAL = (
    "I can't give medical advice — please consult a doctor for that. "
    "I can help with general nutrition and fitness questions, though."
)

# Pre-flight patterns that should hard-refuse before we ever call the model.
_MEDICATIONS = (
    r"metformin|ozempic|insulin|thyroxine|levothyroxine|antibiotics?|steroids?|"
    r"paracetamol|ibuprofen|aspirin|antidepressants?|isotretinoin|accutane|"
    r"medication|medicine|tablets?|pills?"
)

MEDICAL_REFUSAL_PATTERNS = [
    r"\b(dose|dosage)\s+of\b",
    r"\b\d+\s*mg\b",
    r"\b(how much|what dose).{0,40}\b(mg|ml|" + _MEDICATIONS + r")\b",
    r"\b(should i|can i|do i)\b.{0,40}\b(take|stop|increase|reduce|change)\b.{0,40}\b("
    + _MEDICATIONS + r")\b",
    r"\b(take|taking|stop|increase|reduce)\b.{0,30}\b(" + _MEDICATIONS + r")\b",
    r"\b(diagnose|diagnosis)\b",
    r"\bcure\s+(my|for|this)\b",
    r"\b(prescri\w+)\b",
    r"\b(treat(ment)?\s+for|how to treat)\b",
]


def is_medical(query: str) -> bool:
    """True if the query trips a medical-advice refusal pattern."""
    return any(re.search(p, query, re.I) for p in MEDICAL_REFUSAL_PATTERNS)


def validate_citations(text: str, n_sources: int) -> str:
    """Strip `[Source N]` markers whose N is out of range (hallucinated citations).

    Keeps `[Source 1..n_sources]`, removes the rest (and any leftover double spaces).
    """

    def _keep(m: re.Match[str]) -> str:
        n = int(m.group(1))
        return m.group(0) if 1 <= n <= n_sources else ""

    cleaned = re.sub(r"\[Source\s+(\d+)\]", _keep, text)
    return re.sub(r"[ \t]{2,}", " ", cleaned)


def build_context(chunks: list[RetrievedChunk]) -> str:
    return "\n\n".join(
        f"[Source {i + 1}] {c.content}" for i, c in enumerate(chunks)
    )


def build_messages(
    query: str,
    profile_summary: str,
    chunks: list[RetrievedChunk],
    history: list[dict[str, str]],
) -> list[dict[str, str]]:
    """Assemble the chat messages. Critical rules are re-stated alongside context
    so they don't get diluted as history grows (prompt-drift pitfall)."""
    context = build_context(chunks) or "(no sources retrieved)"
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": f"Context from knowledge base:\n{context}"},
        {"role": "system", "content": profile_summary},
        *history,
        {"role": "user", "content": query},
    ]


# ─── streaming generation (network) ───────────────────────────────────────


@lru_cache(maxsize=1)
def _gemini_client():
    """Singleton Gemini client — reuses the HTTP connection pool."""
    from google import genai
    return genai.Client(api_key=settings.gemini_api_key)


async def _stream_gemini(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    from google.genai import types

    client = _gemini_client()
    system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
    contents = [
        types.Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[types.Part(text=m["content"])],
        )
        for m in messages
        if m["role"] in ("user", "assistant")
    ]
    config = types.GenerateContentConfig(system_instruction=system, temperature=0.3)
    stream = await client.aio.models.generate_content_stream(
        model=GEMINI_MODEL, contents=contents, config=config
    )
    async for chunk in stream:
        if chunk.text:
            yield chunk.text


@lru_cache(maxsize=1)
def _groq_client():
    """Singleton Groq client — reuses the HTTP connection pool."""
    from groq import AsyncGroq
    return AsyncGroq(api_key=settings.groq_api_key)


async def _complete_groq(messages: list[dict[str, str]]) -> str:
    client = _groq_client()
    resp = await client.chat.completions.create(
        model=GROQ_MODEL, messages=messages, temperature=0.3  # type: ignore[arg-type]
    )
    return resp.choices[0].message.content or ""


async def generate_response(
    query: str,
    profile_summary: str,
    chunks: list[RetrievedChunk],
    history: list[dict[str, str]],
) -> AsyncIterator[str]:
    """Yield answer tokens. Pre-flight medical refusal; Gemini stream with a Groq
    non-stream fallback yielded as a single chunk on any Gemini failure."""
    if is_medical(query):
        yield MEDICAL_REFUSAL
        return

    messages = build_messages(query, profile_summary, chunks, history)
    try:
        produced = False
        async for token in _stream_gemini(messages):
            produced = True
            yield token
        if produced:
            return
        # Empty stream — fall through to fallback.
        raise RuntimeError("gemini returned an empty stream")
    except Exception as gemini_err:
        logger.warning("Gemini chat failed, falling back to Groq: %s", gemini_err)
        try:
            yield await _complete_groq(messages)
        except Exception as groq_err:
            logger.error("Groq fallback failed: %s", groq_err)
            yield (
                "Sorry — I'm having trouble answering right now. Please try again "
                "in a moment."
            )
