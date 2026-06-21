import { apiFetch } from "./api";

export interface PlateItem {
  dish_id: string;
  name: string;
  portions: number;
  serving_unit: string;
  portion_icon: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  reason: string;
}

export interface GapFill {
  item_id: string;
  name: string;
  portions: number;
  cost_inr: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  text: string;
}

export interface MacroTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
}

export interface OptimizationResult {
  plan: Record<string, PlateItem[]>;
  daily_totals: MacroTotals;
  daily_targets: MacroTotals;
  gap_fills: GapFill[];
  solver_status: string;
  solve_time_ms: number;
}

export async function optimizeToday(): Promise<OptimizationResult> {
  return apiFetch<OptimizationResult>("/api/v1/optimize/today", { method: "POST" });
}

export async function optimizeFromPhoto(file: File): Promise<OptimizationResult> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<OptimizationResult>("/api/v1/optimize/photo", {
    method: "POST",
    body: formData,
  });
}
