"""Goal engine.

Pure functions that turn a user's profile into nutrition targets:
BMI, BMR, TDEE, daily kcal, and macros.

This is the engineering centerpiece of MessFit — the optimizer (Phase 3)
treats these targets as constraints, and every plate the app
recommends flows from these numbers. So:

* No I/O, no DB, no randomness — pure math, deterministic, easy to test.
* Reference values are documented inline so a nutritionist can audit
  every choice.
* The ``Targets`` return type is frozen so downstream code can't quietly
  mutate it.

References
----------
* Mifflin MD et al. (1990) "A new predictive equation for resting
  energy expenditure in healthy individuals" — the BMR formula.
* WHO Expert Consultation (2004), Lancet 363:157-163 — Asia-Pacific
  BMI cutoffs (23 / 25 vs Western 25 / 30).
* ICMR-NIN RDA 2020 — protein-per-kg recommendations.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Literal

# ─── constants ─────────────────────────────────────────────────────────

# Asia-Pacific BMI cutoffs (WHO 2004 — different from Western!)
BMI_UNDERWEIGHT_MAX = 18.5  # < 18.5  -> underweight
BMI_NORMAL_MAX = 22.9  # 18.5–22.9 -> normal
BMI_OVERWEIGHT_MAX = 24.9  # 23.0–24.9 -> overweight; >= 25 -> obese

ACTIVITY_FACTORS: dict[int, float] = {
    1: 1.2,  # sedentary (desk + no exercise)
    2: 1.375,  # light (1–3 sessions/week)
    3: 1.55,  # moderate (3–5 sessions/week)
    4: 1.725,  # active (6–7 sessions/week)
    5: 1.9,  # very active (athlete or physical job)
}

KCAL_PER_KG_BODY = 7700  # standard textbook constant
DAILY_KCAL_DELTA_CAP = 500  # safety cap on surplus/deficit per day

BmiClass = Literal["underweight", "normal", "overweight", "obese"]


@dataclass(frozen=True)
class Targets:
    """Output of :func:`compute_targets` — frozen so callers can't mutate."""

    bmi: float
    bmi_class: BmiClass
    bmr: float
    tdee: float
    daily_kcal: int
    daily_protein_g: int
    daily_carbs_g: int
    daily_fats_g: int
    rationale: dict[str, Any]


# ─── individual building blocks ────────────────────────────────────────


def compute_age(dob: date, today: date) -> int:
    """Whole-year age. Birthday must have occurred in ``today``'s year."""
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def compute_bmi(height_cm: float, weight_kg: float) -> float:
    """BMI rounded to 1 decimal."""
    h_m = height_cm / 100
    return round(weight_kg / (h_m * h_m), 1)


def classify_bmi(bmi: float) -> BmiClass:
    """Asia-Pacific BMI classification (WHO 2004)."""
    if bmi < BMI_UNDERWEIGHT_MAX:
        return "underweight"
    if bmi <= BMI_NORMAL_MAX:
        return "normal"
    if bmi <= BMI_OVERWEIGHT_MAX:
        return "overweight"
    return "obese"


def compute_bmr_mifflin_st_jeor(
    weight_kg: float, height_cm: float, age: int, sex: str
) -> float:
    """Mifflin-St Jeor BMR (kcal/day).

    Formula: ``10*weight + 6.25*height - 5*age + (5 if male else -161)``.

    'other' is treated like 'female' (the more conservative offset);
    documented choice. If the user provides a more specific value
    later, this can be revisited.
    """
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return base + (5 if sex == "male" else -161)


def compute_tdee(bmr: float, activity_level: int) -> float:
    """Total daily energy expenditure = BMR * activity factor."""
    return bmr * ACTIVITY_FACTORS[activity_level]


def compute_daily_kcal(tdee: float, target_rate_kg_per_week: float) -> int:
    """Daily kcal target.

    Surplus (positive rate) or deficit (negative rate) translates from
    7700 kcal/kg. Clamped to ±500 kcal/day so even an aggressive 1
    kg/week request becomes a safer ~0.45 kg/week.
    """
    delta_per_day = target_rate_kg_per_week * KCAL_PER_KG_BODY / 7
    delta_per_day = max(
        -float(DAILY_KCAL_DELTA_CAP), min(float(DAILY_KCAL_DELTA_CAP), delta_per_day)
    )
    return int(round(tdee + delta_per_day))


# ─── macros ────────────────────────────────────────────────────────────


def _protein_per_kg(goal: str, conditions: list[str]) -> float:
    """g of protein per kg of body weight, by goal and conditions."""
    if goal == "gain":
        per_kg = 1.6
    elif goal == "lose":
        per_kg = 2.0  # higher to preserve muscle in deficit
    else:
        per_kg = 1.2

    if "pcos" in conditions:
        per_kg += 0.1  # small bump for insulin sensitivity

    return per_kg


def _fats_g(daily_kcal: int, weight_kg: float, conditions: list[str]) -> int:
    """Fats target in grams.

    Floor: 0.8 g/kg of body weight (essential fatty acids).
    Default: 25% of total kcal from fat.
    Diabetes/PCOS: bump to 30% to displace some carbs.
    """
    floor_g = int(round(weight_kg * 0.8))
    pct = 0.30 if ("diabetes" in conditions or "pcos" in conditions) else 0.25
    pct_g = int(round(daily_kcal * pct / 9))
    return max(floor_g, pct_g)


def compute_macros(
    daily_kcal: int,
    weight_kg: float,
    goal: str,
    conditions: list[str],
) -> tuple[int, int, int]:
    """Returns (protein_g, carbs_g, fats_g).

    Carbs are the remainder of the kcal budget after protein + fats.
    Never returns a negative carbs figure — clamped to zero if the
    budget would otherwise go red.
    """
    protein_g = int(round(weight_kg * _protein_per_kg(goal, conditions)))
    fats_g = _fats_g(daily_kcal, weight_kg, conditions)

    protein_kcal = protein_g * 4
    fats_kcal = fats_g * 9
    carbs_kcal = max(0, daily_kcal - protein_kcal - fats_kcal)
    carbs_g = int(round(carbs_kcal / 4))

    return protein_g, carbs_g, fats_g


# ─── orchestrator ──────────────────────────────────────────────────────


def compute_targets(
    *,
    dob: date,
    sex: str,
    height_cm: float,
    current_weight_kg: float,
    target_rate_kg_per_week: float,
    goal: str,
    activity_level: int,
    conditions: list[str],
    today: date,
    adaptive_tdee_override: float | None = None,
) -> Targets:
    """End-to-end: profile -> Targets.

    Build the rationale dict alongside the numbers so the UI can render
    the math step-by-step. We compute every piece fresh — duplication
    is intentional, this function should be readable top-to-bottom.
    """
    age = compute_age(dob, today)
    bmi = compute_bmi(height_cm, current_weight_kg)
    bmi_class = classify_bmi(bmi)

    bmr = round(compute_bmr_mifflin_st_jeor(current_weight_kg, height_cm, age, sex), 1)
    
    if adaptive_tdee_override is not None:
        tdee = round(adaptive_tdee_override, 1)
        tdee_rationale = f"Adaptive TDEE calculated from your logged weight & meals = {tdee}"
    else:
        tdee = round(compute_tdee(bmr, activity_level), 1)
        tdee_rationale = f"BMR × activity factor {ACTIVITY_FACTORS[activity_level]} = {tdee}"
        
    daily_kcal = compute_daily_kcal(tdee, target_rate_kg_per_week)
    protein_g, carbs_g, fats_g = compute_macros(
        daily_kcal, current_weight_kg, goal, conditions
    )

    delta_per_day = int(
        max(
            -DAILY_KCAL_DELTA_CAP,
            min(
                DAILY_KCAL_DELTA_CAP,
                round(target_rate_kg_per_week * KCAL_PER_KG_BODY / 7),
            ),
        )
    )
    sex_offset = "+5" if sex == "male" else "−161"
    fats_pct = round(fats_g * 9 / daily_kcal * 100) if daily_kcal else 0

    rationale: dict[str, Any] = {
        "age": age,
        "bmi_formula": (f"{current_weight_kg} kg ÷ ({height_cm / 100} m)² = {bmi}"),
        "bmi_classification_basis": "Asia-Pacific cutoffs (WHO 2004)",
        "bmr_formula": (
            f"Mifflin-St Jeor: 10·{current_weight_kg} + 6.25·{height_cm} "
            f"− 5·{age} {sex_offset} = {bmr}"
        ),
        "tdee_formula": tdee_rationale,
        "kcal_target_basis": (
            f"TDEE {tdee} {'+' if delta_per_day >= 0 else '−'} "
            f"{abs(delta_per_day)} kcal/day (capped at ±{DAILY_KCAL_DELTA_CAP}) "
            f"= {daily_kcal}"
        ),
        "protein_basis": (
            f"{protein_g} g (≈ {round(protein_g / current_weight_kg, 1)} g/kg "
            f"body weight)"
        ),
        "fats_basis": f"{fats_g} g (≈ {fats_pct}% of kcal)",
        "carbs_basis": f"{carbs_g} g (remainder of kcal budget)",
        "conditions_applied": list(conditions),
    }

    return Targets(
        bmi=bmi,
        bmi_class=bmi_class,
        bmr=bmr,
        tdee=tdee,
        daily_kcal=daily_kcal,
        daily_protein_g=protein_g,
        daily_carbs_g=carbs_g,
        daily_fats_g=fats_g,
        rationale=rationale,
    )
