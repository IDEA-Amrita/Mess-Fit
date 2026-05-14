# ADR-004: PWA over React Native for V1

| | |
|---|---|
| **Date** | 2026-05-15 |
| **Status** | Proposed |
| **Decider(s)** | @kavinesh, @teammate |
| **Related** | |

---

## Context

The product is mobile-first (hostel students photograph their plate,
log meals, check the day's menu). We need to decide: ship a PWA from
the start, or build a React Native app.

## Decision

V1 ships as a **Next.js PWA** (installable, offline-capable for cached
routes, push via web-push). React Native is deferred to V2 if PWA
limitations bite (camera APIs, app-store distribution).

## Consequences

### Positive
- One codebase, one deploy pipeline (Vercel)
- No app-store review delays during early iteration
- Web-only fixes ship in minutes

### Negative
- iOS PWA constraints (no full push, limited home-screen install UX)
- Camera/file APIs less polished than native

### Neutral
- We'll need to be deliberate about offline UX and install prompts

## Alternatives considered

### Alternative 1: React Native (Expo)
**Pros:** Native camera, push, store presence.
**Cons:** Two build pipelines (iOS+Android), app-store review cycles,
duplication with web app or risky web/native code-sharing.
**Why rejected:** Velocity hit before product-market fit is signed.

### Alternative 2: Native iOS + Android
**Pros:** Best UX.
**Cons:** Two codebases for a 2-person team.
**Why rejected:** Not viable at our team size.

## Revisit when
- iOS PWA push limits block a core feature
- We exceed 1K DAU and need an app-store presence for credibility
