/**
 * Shared types mirroring the backend Pydantic schemas.
 * Keep in sync with services/api/messfit_api/profile/schemas.py
 */

export type Sex = "male" | "female" | "other";
export type Goal = "lose" | "maintain" | "gain";
export type DietType = "veg" | "eggetarian" | "non_veg" | "jain";
export type CanteenFreq = "never" | "rare" | "frequent" | "daily";
export type Equipment = "bodyweight" | "bands" | "college_gym" | "home_gym";
export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface ProfilePayload {
  dob: string; // ISO date "YYYY-MM-DD"
  sex: Sex;
  height_cm: number;
  current_weight_kg: number;
  target_weight_kg: number;
  target_rate_kg_per_week: number;
  goal: Goal;
  activity_level: number; // 1–5
  diet_type: DietType;
  allergies: string[];
  conditions: string[];
}

export interface HostelContextPayload {
  mess_id: string | null;
  canteen_freq: CanteenFreq;
  canteen_typical_spend_inr: number;
  top_up_budget_inr_weekly: number;
  equipment: Equipment[];
  workout_minutes_per_day: number;
  workout_days_per_week: number;
  gym_access_days: DayOfWeek[];
}

export interface Targets {
  bmi: number;
  bmi_class: "underweight" | "normal" | "overweight" | "obese";
  bmr: number;
  tdee: number;
  daily_kcal: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fats_g: number;
  rationale: Record<string, string | number | string[]>;
}
