import { apiFetch } from "./api";

export interface Mess {
  id: string;
  name: string;
  college: string;
  city: string;
}

export interface Dish {
  id: string;
  name: string;
  category: string;
  default_serving_unit: string;
  default_serving_grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  portion_icon: string;
  tags: string[];
}

export interface MessMenu {
  id: string;
  mess_id: string;
  effective_from: string;
  day_of_week: number;
  meal_type: string;
  dish_id: string;
  availability: string;
  dish: Dish;
}

export interface DailyMenuResponse {
  date: string;
  day_of_week: number;
  breakfast: MessMenu[];
  lunch: MessMenu[];
  snack: MessMenu[];
  dinner: MessMenu[];
}

export async function getMesses(): Promise<Mess[]> {
  return apiFetch<Mess[]>("/mess/messes");
}

export async function getDishes(query?: string): Promise<Dish[]> {
  const q = query ? `?query=${encodeURIComponent(query)}` : "";
  return apiFetch<Dish[]>(`/mess/dishes${q}`);
}

export async function getDailyMenu(messId: string, dateStr?: string): Promise<DailyMenuResponse> {
  const query = dateStr ? `?date=${dateStr}` : "";
  return apiFetch<DailyMenuResponse>(`/mess/messes/${messId}/menu${query}`);
}

// ─── Dish exclusions ──────────────────────────────────────────────────

export interface DishExclusion {
  date: string;
  meal_type: string;
  dish_id: string;
}

export async function getExclusions(dateStr: string): Promise<DishExclusion[]> {
  return apiFetch<DishExclusion[]>(`/mess/menu/exclusions?date=${dateStr}`);
}

export async function excludeDish(payload: DishExclusion): Promise<DishExclusion> {
  return apiFetch<DishExclusion>("/mess/menu/exclusions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function unexcludeDish(
  dishId: string,
  dateStr: string,
  mealType: string,
): Promise<void> {
  await apiFetch<void>(
    `/mess/menu/exclusions/${dishId}?date=${dateStr}&meal_type=${mealType}`,
    { method: "DELETE" },
  );
}
