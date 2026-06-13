/**
 * API client for the admin OCR pipeline (Phase 4).
 *
 * Uploads go through a raw fetch (multipart) because the shared apiFetch
 * forces a JSON content-type; everything else reuses apiFetch.
 */

import { apiFetch, ApiError } from "./api";
import { supabase } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type OcrStatus =
  | "pending"
  | "processing"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "failed";

export interface OcrJobSummary {
  id: string;
  mess_id: string;
  status: OcrStatus;
  error_message: string | null;
}

/** A parsed dish enriched by the worker with its best catalog match. */
export interface ParsedDish {
  name: string;
  confidence_low: boolean;
  matched_dish_id: string | null;
  matched_name: string | null;
  match_score: number | null;
  needs_review: boolean;
}

export interface ParsedMeal {
  type: "breakfast" | "lunch" | "snack" | "dinner";
  dishes: ParsedDish[];
}

export interface ParsedDay {
  day: string;
  meals: ParsedMeal[];
}

export interface ParsedResult {
  weekly: ParsedDay[];
}

export interface OcrJobDetail {
  id: string;
  mess_id: string;
  status: OcrStatus;
  parsed_result: ParsedResult | null;
  error_message: string | null;
  image_url: string | null;
}

// ── approve payload ────────────────────────────────────────────────────

export interface ReviewedDish {
  name: string;
  dish_id: string | null; // null → create as draft
}

export interface ReviewedMeal {
  type: ParsedMeal["type"];
  dishes: ReviewedDish[];
}

export interface ReviewedDay {
  day_of_week: number; // 0=Mon … 6=Sun
  meals: ReviewedMeal[];
}

export interface ApprovePayload {
  effective_from: string; // ISO date
  weekly: ReviewedDay[];
}

export interface ApproveResult {
  status: string;
  dishes_created: number;
  menu_rows_added: number;
}

// ── calls ──────────────────────────────────────────────────────────────

export async function uploadMenuPhoto(
  messId: string,
  file: File,
): Promise<OcrJobSummary> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new ApiError(401, "Not authenticated");

  const form = new FormData();
  form.append("mess_id", messId);
  form.append("file", file);

  // No Content-Type header — the browser sets the multipart boundary.
  const res = await fetch(`${BASE}/mess/admin/ocr/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<OcrJobSummary>;
}

export async function listOcrJobs(messId?: string): Promise<OcrJobSummary[]> {
  const q = messId ? `?mess_id=${messId}` : "";
  return apiFetch<OcrJobSummary[]>(`/mess/admin/ocr/jobs${q}`);
}

export async function getOcrJob(id: string): Promise<OcrJobDetail> {
  return apiFetch<OcrJobDetail>(`/mess/admin/ocr/jobs/${id}`);
}

export async function approveOcrJob(
  id: string,
  payload: ApprovePayload,
): Promise<ApproveResult> {
  return apiFetch<ApproveResult>(`/mess/admin/ocr/jobs/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function rejectOcrJob(id: string): Promise<OcrJobSummary> {
  return apiFetch<OcrJobSummary>(`/mess/admin/ocr/jobs/${id}/reject`, {
    method: "POST",
  });
}

// ── helpers ──────────────────────────────────────────────────────────────

export const DAY_NAME_TO_INDEX: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
  friday: 4, saturday: 5, sunday: 6,
};

/** Map a printed day name ("Monday", "Mon") to 0-6, or null if unrecognized. */
export function dayNameToIndex(day: string): number | null {
  const key = day.trim().toLowerCase();
  if (key in DAY_NAME_TO_INDEX) return DAY_NAME_TO_INDEX[key];
  const short = key.slice(0, 3);
  const match = Object.keys(DAY_NAME_TO_INDEX).find((d) => d.startsWith(short));
  return match !== undefined ? DAY_NAME_TO_INDEX[match] : null;
}
