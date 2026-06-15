# Knowledge base (chatbot RAG sources)

Each `*.md` file here is one curated, **original** article (no copyrighted text) used
to ground the chatbot's answers. The first `# Heading` line becomes the document
title; `source` is `curated`. Ingest with:

```
uv run python scripts/ingest_kb.py
```

This is the **starter** KB (Phase 7). The full corpus is an outstanding data task:

- **IFCT 2017** (NIN Hyderabad food-composition tables) → narrative per-food text.
- **ICMR RDA 2020** recommended dietary allowances, chunked by demographic.
- **ACSM** exercise guidelines, chunked by category.
- ~30 curated articles total (we have ~9 here).

When adding sources, convert tables to narrative prose before ingesting (embeddings
work best on natural sentences), keep each file single-topic, and re-run the script —
ingestion is idempotent on `(source, title)`.
