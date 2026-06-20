import { apiFetch } from "./api";

// ── types ──────────────────────────────────────────────────────────────────

export type MealType = "breakfast" | "lunch" | "snack" | "dinner";
export type MealStatus = "as_planned" | "different" | "skipped";

export interface MealLogIn {
  date: string; // YYYY-MM-DD
  meal_type: MealType;
  status: MealStatus;
  notes?: string | null;
  kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fats_g?: number | null;
}

export interface MealLogOut {
  id: string;
  date: string;
  meal_type: MealType;
  status: MealStatus;
  notes: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fats_g: number | null;
}

export interface WeightLogIn {
  date: string;
  weight_kg: number;
}

export interface WeightLogOut {
  date: string;
  weight_kg: number;
}

export interface SubjectiveLogIn {
  date: string;
  energy?: number | null;
  hunger?: number | null;
  mood?: number | null;
}

export interface SubjectiveLogOut {
  date: string;
  energy: number | null;
  hunger: number | null;
  mood: number | null;
}

export interface TodayLogs {
  date: string;
  meals: MealLogOut[];
  weight: WeightLogOut | null;
  subjective: SubjectiveLogOut | null;
  workout_status: string | null;
}

export interface PhotoMealEstimate {
  meal_type: string;
  dishes: {
    name: string;
    portion: string;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fats_g: number;
  }[];
  total_kcal: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fats_g: number;
  confidence: "high" | "medium" | "low";
}

export interface WeightPoint {
  date: string;
  weight_kg: number;
}

export type ProgressRange = "7d" | "30d" | "90d";

export interface Projection {
  available: boolean;
  reason?: string;
  stalled?: boolean;
  moving_wrong_direction?: boolean;
  current_rate_kg_per_week?: number;
  target_rate_kg_per_week?: number;
  projected_target_date?: string;
  on_track?: boolean;
}

export interface Progress {
  range: string;
  weight_series: WeightPoint[];
  adherence_rate: number;
  macro_hit_rate: number | null;
  projection: Projection;
  streak_days: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Today's date as YYYY-MM-DD in the local (IST) timezone. */
export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

// ── calls ──────────────────────────────────────────────────────────────────

export async function getTodayLogs(): Promise<TodayLogs> {
  return apiFetch<TodayLogs>("/api/v1/logs/today");
}

export async function logMeal(payload: MealLogIn): Promise<MealLogOut> {
  return apiFetch<MealLogOut>("/api/v1/logs/meals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logMealPhoto(file: File, mealType: MealType): Promise<PhotoMealEstimate> {
  const formData = new FormData();
  formData.append("photo", file);
  formData.append("meal_type", mealType);

  // Use raw fetch because we're sending FormData, not JSON.
  const token = localStorage.getItem("messfit_access_token");
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/logs/photo`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Failed to analyze photo");
  }

  return res.json();
}

export async function logWeight(payload: WeightLogIn): Promise<WeightLogOut> {
  return apiFetch<WeightLogOut>("/api/v1/logs/weight", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logSubjective(
  payload: SubjectiveLogIn,
): Promise<SubjectiveLogOut> {
  return apiFetch<SubjectiveLogOut>("/api/v1/logs/subjective", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getProgress(range: ProgressRange): Promise<Progress> {
  return apiFetch<Progress>(`/api/v1/logs/progress?range=${range}`);
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  meals_followed: number;
  workouts_done: number;
  score: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  user_rank: LeaderboardEntry | null;
}

export async function getLeaderboard(days: number = 7): Promise<LeaderboardResponse> {
  return apiFetch<LeaderboardResponse>(`/api/v1/logs/leaderboard?days=${days}`);
}
