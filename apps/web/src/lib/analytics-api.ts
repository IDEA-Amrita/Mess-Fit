import { apiFetch } from "./api";

export interface AnalyticsSummary {
  window_days: number;
  total_events: number;
  active_users_window: number;
  dau: { day: string; users: number }[];
  by_event: { name: string; events: number; users: number }[];
}

export function getAnalyticsSummary(days: number) {
  return apiFetch<AnalyticsSummary>(`/api/v1/analytics/summary?days=${days}`);
}
