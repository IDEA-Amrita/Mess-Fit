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
