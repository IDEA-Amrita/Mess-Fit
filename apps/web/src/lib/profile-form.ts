/**
 * Pure logic shared by the onboarding steps and the Settings profile editor:
 * option lists, validation, goal normalisation and the estimates shown while
 * the user fills the form. No React in here, so it is trivially testable.
 *
 * The numeric rules mirror the backend (`profile/schemas.py`, `goal_engine.py`).
 * If those change, change these constants with them.
 */

import { addWeeks } from "date-fns";
import type {
  CanteenFreq,
  DietType,
  Equipment,
  Goal,
  HostelContextPayload,
  ProfilePayload,
} from "./types";

/** Everything the onboarding/settings forms edit, flattened into one shape. */
export type ProfileForm = ProfilePayload & HostelContextPayload;

// ─── option lists ───────────────────────────────────────────────────────

export const GOALS: { value: Goal; label: string; desc: string }[] = [
  { value: "gain", label: "Gain weight", desc: "Build muscle, increase mass" },
  { value: "lose", label: "Lose weight", desc: "Cut fat, get leaner" },
  { value: "maintain", label: "Maintain", desc: "Stay where you are" },
];

export const ACTIVITY_LABELS: Record<number, string> = {
  1: "Sedentary (desk + no exercise)",
  2: "Light (1–3 sessions/week)",
  3: "Moderate (3–5 sessions/week)",
  4: "Active (6–7 sessions/week)",
  5: "Very active (athlete / physical job)",
};

export const DIET_OPTIONS: { value: DietType; label: string }[] = [
  { value: "veg", label: "Vegetarian" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "non_veg", label: "Non-vegetarian" },
  { value: "jain", label: "Jain" },
];

export const ALLERGY_OPTIONS = [
  "lactose",
  "gluten",
  "nuts",
  "soy",
  "eggs",
  "seafood",
  "mustard",
  "sesame",
];

export const CONDITION_OPTIONS = [
  { value: "diabetes", label: "Diabetes" },
  { value: "hypertension", label: "Hypertension" },
  { value: "pcos", label: "PCOS" },
  { value: "ibs", label: "IBS" },
  { value: "gerd", label: "GERD" },
  { value: "anemia", label: "Anemia" },
  { value: "hypothyroid", label: "Hypothyroid" },
];

export const CANTEEN_OPTIONS: { value: CanteenFreq; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "rare", label: "Rare (1–2×/week)" },
  { value: "frequent", label: "Frequent (3–5×/week)" },
  { value: "daily", label: "Daily" },
];

export const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: "bodyweight", label: "Bodyweight only" },
  { value: "bands", label: "Resistance bands" },
  { value: "college_gym", label: "College gym" },
  { value: "home_gym", label: "Home gym" },
];

// ─── numeric limits (backend CHECK constraints) ─────────────────────────

export const LIMITS = {
  height: { min: 120, max: 220 },
  weight: { min: 30, max: 150 }, // backend allows 200; the slider stops at 150
  rate: { min: 0.1, max: 0.5 },
} as const;

/** The backend caps the daily surplus/deficit at ±500 kcal (7700 kcal per kg). */
const KCAL_PER_KG = 7700;
const DAILY_KCAL_CAP = 500;
export const MAX_EFFECTIVE_RATE = (DAILY_KCAL_CAP * 7) / KCAL_PER_KG; // ≈ 0.4545 kg/week
const DEFAULT_RATE = 0.25;
const DEFAULT_TARGET_OFFSET_KG = 5;

// ─── BMI (Asia-Pacific cutoffs, same as the goal engine) ────────────────

export type BmiClass = "underweight" | "normal" | "overweight" | "obese";

export const BMI_COLORS: Record<BmiClass, string> = {
  underweight: "#60a5fa",
  normal: "#34d399",
  overweight: "#fbbf24",
  obese: "#f87171",
};

export function computeBmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function classifyBmi(bmi: number): BmiClass {
  if (bmi < 18.5) return "underweight";
  if (bmi <= 22.9) return "normal";
  if (bmi <= 24.9) return "overweight";
  return "obese";
}

// ─── dates ──────────────────────────────────────────────────────────────

/** Local `YYYY-MM-DD` (not `toISOString`, which shifts the day in +05:30). */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const MIN_DOB = "1920-01-01";

// ─── validation ─────────────────────────────────────────────────────────

/** `null` means valid. Messages are shown to the user verbatim. */
export function validateBody(v: Pick<ProfileForm, "dob">, today = new Date()): string | null {
  if (!v.dob) return "Enter your date of birth.";
  if (v.dob > isoDate(today)) return "Date of birth can't be in the future.";
  if (v.dob < MIN_DOB) return "Enter a valid date of birth.";
  return null;
}

export function validateGoal(
  v: Pick<ProfileForm, "goal" | "current_weight_kg" | "target_weight_kg">,
): string | null {
  if (v.goal === "gain" && v.target_weight_kg <= v.current_weight_kg) {
    return `To gain weight, set a target above your current ${v.current_weight_kg} kg.`;
  }
  if (v.goal === "lose" && v.target_weight_kg >= v.current_weight_kg) {
    return `To lose weight, set a target below your current ${v.current_weight_kg} kg.`;
  }
  return null;
}

// ─── goal normalisation ─────────────────────────────────────────────────

/**
 * The fields a goal implies. Returned as a patch so callers apply it in one go.
 *
 * `lose` with a rate of 0 would silently produce a *maintenance* calorie target
 * (the engine derives the deficit from the rate alone), so gain/lose always get
 * a real, correctly-signed rate.
 */
export function goalPatch(
  v: Pick<ProfileForm, "current_weight_kg" | "target_weight_kg" | "target_rate_kg_per_week">,
  goal: Goal,
): Pick<ProfileForm, "goal" | "target_weight_kg" | "target_rate_kg_per_week"> {
  if (goal === "maintain") {
    return { goal, target_weight_kg: v.current_weight_kg, target_rate_kg_per_week: 0 };
  }
  const magnitude = Math.abs(v.target_rate_kg_per_week) || DEFAULT_RATE;
  const sign = goal === "lose" ? -1 : 1;
  const onRightSide =
    goal === "lose"
      ? v.target_weight_kg < v.current_weight_kg
      : v.target_weight_kg > v.current_weight_kg;
  const target = onRightSide
    ? v.target_weight_kg
    : clamp(
        v.current_weight_kg + sign * DEFAULT_TARGET_OFFSET_KG,
        LIMITS.weight.min,
        LIMITS.weight.max,
      );
  return { goal, target_weight_kg: target, target_rate_kg_per_week: sign * magnitude };
}

/**
 * Re-derives the goal-dependent fields from the current weight. Run before
 * submitting: the user may have changed their weight on an earlier step after
 * picking "maintain", which would leave a stale target behind.
 */
export function normalizeGoal<T extends ProfileForm>(v: T): T {
  return { ...v, ...goalPatch(v, v.goal) };
}

// ─── estimates shown while filling the form ─────────────────────────────

export interface GoalEstimate {
  weeks: number;
  reachedOn: Date;
  /** True when the requested rate is above what the daily kcal cap allows. */
  capped: boolean;
  effectiveRate: number;
}

export function estimateGoal(
  v: Pick<ProfileForm, "goal" | "current_weight_kg" | "target_weight_kg" | "target_rate_kg_per_week">,
  from = new Date(),
): GoalEstimate | null {
  if (v.goal === "maintain" || validateGoal(v)) return null;
  const requested = Math.abs(v.target_rate_kg_per_week);
  if (requested <= 0) return null;
  const effectiveRate = Math.min(requested, MAX_EFFECTIVE_RATE);
  const weeks = Math.ceil(Math.abs(v.target_weight_kg - v.current_weight_kg) / effectiveRate);
  return {
    weeks,
    reachedOn: addWeeks(from, weeks),
    capped: requested > MAX_EFFECTIVE_RATE,
    effectiveRate,
  };
}

// ─── payloads ───────────────────────────────────────────────────────────

export function toProfilePayload(v: ProfileForm): ProfilePayload {
  return {
    dob: v.dob,
    sex: v.sex,
    height_cm: v.height_cm,
    current_weight_kg: v.current_weight_kg,
    target_weight_kg: v.target_weight_kg,
    target_rate_kg_per_week: v.target_rate_kg_per_week,
    goal: v.goal,
    activity_level: v.activity_level,
    diet_type: v.diet_type,
    allergies: v.allergies,
    conditions: v.conditions,
  };
}

export function toHostelPayload(v: ProfileForm): HostelContextPayload {
  return {
    mess_id: v.mess_id,
    canteen_freq: v.canteen_freq,
    canteen_typical_spend_inr: v.canteen_typical_spend_inr,
    top_up_budget_inr_weekly: v.top_up_budget_inr_weekly,
    equipment: v.equipment,
    workout_minutes_per_day: v.workout_minutes_per_day,
    workout_days_per_week: v.workout_days_per_week,
    gym_access_days: v.gym_access_days,
  };
}

/** Used when a profile exists but its hostel context was never saved. */
export const HOSTEL_DEFAULTS: HostelContextPayload = {
  mess_id: null,
  canteen_freq: "rare",
  canteen_typical_spend_inr: 50,
  top_up_budget_inr_weekly: 200,
  equipment: ["bodyweight"],
  workout_minutes_per_day: 30,
  workout_days_per_week: 3,
  gym_access_days: [],
};

/** Field-by-field equality that ignores the order of array fields (chips can be toggled off and on). */
export function formsEqual(a: ProfileForm, b: ProfileForm): boolean {
  return (Object.keys(a) as (keyof ProfileForm)[]).every((k) => {
    const x = a[k];
    const y = b[k];
    if (Array.isArray(x) && Array.isArray(y)) {
      return x.length === y.length && [...x].sort().join(",") === [...y].sort().join(",");
    }
    return x === y;
  });
}

/** Immutable add/remove of `item` in `list`. */
export function toggleItem<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
