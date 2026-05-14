# MessFit — Product Requirements Document

| | |
|---|---|
| **Version** | 1.0 |
| **Status** | Draft → For approval |
| **Owner** | Kavinesh P (Backend), [Teammate] (Frontend) |
| **Last updated** | May 2026 |
| **Reviewers** | [Senior 1], [Senior 2], Mentor |

---

## 1. Summary

MessFit is a constraint-based plate optimizer for Indian hostel students. It takes today's mess menu, the user's goal (gain/lose/maintain), their dietary and medical constraints, their canteen access frequency, and their workout equipment access — and produces a personalized daily nutrition and workout plan with portion-level recommendations, one-line reasons, and visual portion guides.

Unlike existing nutrition apps that recommend foods users cannot access, MessFit optimizes *within* the constraints of mess subscription, limited canteen budget, and hostel-room workout reality.

**Delivery:** Progressive Web App (installable, mobile-first, works offline).

---

## 2. Problem

Indian hostel students (~30M+ nationwide) face a structural mismatch with existing fitness apps:

- **Mess menu is fixed.** Users cannot choose between paratha and oats; they eat what's served.
- **Canteen access is bounded.** Students might afford 1 egg/day or 1 chicken meal/week, not unlimited.
- **Equipment is constrained.** Either hostel-room (no equipment) or shared college gym, often time-limited.
- **Existing apps assume free food access.** HealthifyMe, NutriScan, and similar suggest foods unavailable in the mess. Users disengage within 2 weeks.

The gap is not generic Indian-cuisine awareness (NutriScan and niwi.ai cover that). The gap is **access-aware optimization** — recommending portions of available foods, not substitutions to ideal ones.

---

## 3. Goals & Non-Goals

### Goals
1. Generate nutritionally valid daily plans within ±10% of user's macro targets, respecting all dietary, medical, and access constraints.
2. Explain every recommendation with a one-line reason tied to the user's stated goal.
3. Visualize portions as everyday objects (fist, palm, katori) — not grams.
4. Achieve ≥60% day-7 retention and ≥40% day-14 retention with pilot users.
5. Deliver as a PWA usable on ₹15K Android phones over 4G.

### Non-Goals (V1)
- Not a calorie tracker for non-mess foods (V2)
- Not a native mobile app (PWA only)
- Not multi-language (V2)
- Not a medical advisor — chatbot refuses condition-specific medical queries
- Not a replacement for a doctor or dietitian
- No social/community features in V1
- No payments or premium tier in V1

---

## 4. Target Users

| Persona | Profile | Primary Goal |
|---|---|---|
| **Underweight bulker** | Male hosteler, 18–22, BMI <19, mess + occasional canteen | Gain 5–8 kg lean mass |
| **Cutting student** | Any sex, BMI 23+, often with PCOS/diabetes/hypertension | Lose 4–8 kg sustainably |
| **Maintaining athlete** | Sports/fitness-active student, BMI normal | Maintain weight, hit protein targets |

**Primary geography for V1:** Amrita Vishwa Vidyapeetham, Coimbatore. Expandable to other Indian colleges via mess menu OCR.

---

## 5. Key Differentiators

| Feature | Existing apps | MessFit |
|---|---|---|
| Food source | Suggests ideal foods | Optimizes today's mess menu |
| Canteen modeling | Unlimited | Frequency-bounded (rare/weekly/daily) with budget |
| Output unit | Foods to buy | Portions of available foods |
| Reasoning | None or generic | One-line, goal-aligned, per dish |
| Portion display | Grams | Visual icons (fist/palm/katori) |
| Decision logic | LLM-generated meal plans | Constraint-based optimization (MILP/CP-SAT) |

The core engineering differentiator is the **constraint optimizer**: a deterministic solver (PuLP/OR-Tools) handles the meal decision; the LLM only narrates reasons. This makes recommendations reproducible, traceable, and medically defensible — and makes the project genuinely engineering-deep instead of an LLM-API wrapper.

---

## 6. Core Features (V1)

### 6.1 Onboarding & Goal Engine
User enters height, weight, age, sex, activity level, goal (gain/lose/maintain) with target rate, diet type (veg/eggetarian/non-veg/Jain), allergies, medical conditions, mess subscribed, canteen access frequency and budget, equipment access, workout time/days available.

System computes BMI (Asia-Pacific cutoffs), BMR (Mifflin-St Jeor), TDEE, daily kcal target, and macro split. Math is shown transparently in a "Why these numbers?" view.

### 6.2 Mess Menu Management
Pre-loaded weekly menus for Amrita Coimbatore messes. Users select their mess; view today's and the week's menu. New messes onboarded via **OCR pipeline** (Gemini Vision multimodal): admin uploads a photo of the printed menu, system extracts structure, admin reviews and approves.

### 6.3 Dish Nutrition Database
Seed database of 150+ common Indian mess dishes with per-serving nutrition sourced from IFCT 2017 (NIN Hyderabad). Each dish has multiple supported serving units (katori, cup, piece, chapati). Dishes not in IFCT are estimated via Gemini with citation requirements and queued for verification.

### 6.4 Plate Optimizer (engineering core)
For a given day:
- **Inputs:** today's menu, user's targets, canteen availability + budget, optional pantry, skip list
- **Algorithm:** Mixed-Integer Linear Programming (PuLP) with squared-deviation objective and 12+ constraints (calorie band, protein floor, allergen exclusion, diet type, condition rules, portion bounds, canteen budget, canteen frequency)
- **Output:** per-meal portion recommendations + daily totals + gap-fill suggestions
- **Performance target:** p95 solve time <500ms

### 6.5 Plate View (Reasons + Visual Portions)
Each recommended portion shows:
- Dish name + portion (e.g., "2 katori sambar")
- Visual icon (fist / palm / katori / thumb / cupped hand)
- One-line reason: "Gives you 18g of your 80g protein target"

Reasons are templated initially (~15 templates derived from optimizer constraint deltas); LLM polishes only when templates feel robotic.

### 6.6 Workout Planner
Four workout templates × four duration variants (15/30/45/60 min) = 16 plans:
- Bodyweight Hostel-Room (gain)
- Bodyweight Hostel-Room (lose)
- College Gym Bro Split (gain)
- College Gym Full Body (lose/maintain)

Each exercise has sets × reps, embedded YouTube demo, rest timer. Weekly progressive overload.

### 6.7 Daily Logging & Progress
- Mark each meal: ate as planned / different / skipped
- Daily weight log
- Mark workouts: done / skipped (with reason)
- Subjective log: energy, hunger, mood (1–5)
- Progress dashboard: weight chart, adherence rate, macro hit rate, projection ("on track to hit 62 kg by July 15")

### 6.8 Chatbot
RAG-based chatbot grounded in IFCT, ICMR RDA 2020, ACSM guidelines, and curated articles. Context-aware (knows user's profile and today's plan). Strict guardrails: refuses medical advice, refers to doctor for condition-specific questions, marks itself as AI clearly.

### 6.9 Educational Content
15 markdown articles on protein basics, TDEE, troubleshooting bulks/cuts, PCOS basics, progressive overload, sleep, hydration, etc. Linkable from the chatbot.

### 6.10 Admin Console
For seeding messes, dishes, reviewing OCR outputs, basic operational metrics. Internal tool, minimal styling.

---

## 7. Success Metrics

### Pilot (V1, 10 users at Amrita)
| Metric | Target |
|---|---|
| Signups | ≥10 |
| Day-7 retention | ≥60% |
| Day-14 retention | ≥40% |
| Daily logs per active user | ≥2 |
| Plate accuracy (user-reported) | ≥80% |
| Reason helpfulness (user-rated) | ≥4/5 |

### System
| Metric | Target |
|---|---|
| API p95 latency | <300 ms |
| Optimizer p95 solve time | <500 ms |
| Optimizer infeasibility rate | <5% |
| Chatbot first-token latency p95 | <1.5 s |
| Chatbot medical-advice refusal rate | 100% |
| OCR accuracy on test set | ≥85% |

---

## 8. Future Enhancements (V2+)

Prioritized backlog. Built only after V1 ships and pilot feedback is incorporated.

| Priority | Feature | Description |
|---|---|---|
| F14 | Photo food logging | User photographs plate; Gemini Vision identifies and estimates intake |
| F15 | Adherence behavior system | Streaks with grace tokens, smart nudges based on drop-off patterns |
| F16 | Multi-language UI | Tamil + Hindi translations for onboarding and core flows |
| F17 | Buddy / accountability pairing | Match users with similar goals for streak-keeping |
| F18 | WhatsApp daily check-in bot | Low-friction daily prompt via Twilio WhatsApp Business API |
| F19 | Wearable sync | Mi Band, Boat — pull steps, heart rate for better TDEE estimation |
| F20 | Form-checking via camera | MediaPipe Pose for real-time exercise form feedback |
| F21 | Tuck shop / canteen menu | Full canteen menu integration, not just frequency-bounded |
| F22 | Family/shared cooking mode | For students with shared cooking arrangements |
| F23 | Premium tier | ₹99/mo for deeper analytics, priority chat, dietitian consult |
| F24 | B2B college dashboards | Sell to college nutrition departments / hostel administrators |

---

## 9. Constraints & Assumptions

### Constraints
- 2-person team (Backend + Frontend leads)
- Open-ended timeline; quality over speed
- Free-tier infrastructure throughout pilot
- ₹0–500/month infra budget during pilot
- 10 confirmed pilot users at Amrita Coimbatore

### Assumptions
- Mess menus at Amrita follow weekly cycles (verified)
- Pilot users have Android smartphones with 4G (verified)
- IFCT 2017 covers ≥90% of common mess dishes (to verify in Phase 2)
- A nutritionist mentor can grade 50 evaluation scenarios (to confirm via Amrita's nutrition department)

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Optimizer produces nutritionally invalid plans | Critical | Build 50-scenario eval framework before solver; nutritionist sign-off mandatory |
| Pilot users fail to engage | High | Pre-recruit 10 friends; in-person onboarding sessions |
| Mess menus drift mid-pilot | Medium | Edit-on-the-fly UI; weekly menu refresh process |
| LLM costs spiral | Medium | Semantic cache, rate limits, ₹500/day hard cap |
| Scope creep | High | This PRD is the contract; new asks go to V2+ backlog without exception |

---

## 11. Open Questions for Reviewers

1. Is the Amrita Coimbatore-first geography acceptable, or should we plan multi-college from V1?
2. Are there existing nutritionist contacts at Amrita we can engage for the eval framework?
3. Should we plan for ethics/IRB review given we collect health data, even at pilot scale?
4. Any concerns about the "no medical advice" guardrail strictness — should we go further?

---

## 12. Approvals

| Reviewer | Role | Sign-off | Date |
|---|---|---|---|
| | Senior 1 | | |
| | Senior 2 | | |
| | Mentor | | |

---

*Companion documents: see `02-tdd/TDD.md` for technical architecture, `03-phases/` for build plan.*
