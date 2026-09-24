/**
 * API client for the MessFit backend.
 *
 * Wraps fetch with:
 * - Base URL from env
 * - Supabase access token attached automatically
 * - JSON content-type by default
 * - Typed error handling
 */

import { supabase } from "./supabase";
import * as Sentry from "@sentry/nextjs";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

async function getToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new ApiError(401, "Not authenticated");
  }
  return session.access_token;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();

  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const errorMsg = body.detail ?? res.statusText;
    const error = new ApiError(res.status, errorMsg);
    
    // Log to Sentry on client side (A11)
    Sentry.captureException(error, {
      extra: { path, method: options.method ?? "GET", status: res.status }
    });
    console.error(`[API Error] ${options.method ?? "GET"} ${path} -> ${res.status}: ${errorMsg}`);
    
    throw error;
  }

  // 204/205 (and any other genuinely empty body) have nothing to parse — the
  // two DELETE endpoints that return 204 (unexclude-dish, notifications
  // unsubscribe) made every caller's success path throw a SyntaxError from
  // `res.json()` on an empty string, which callers then treated as a failure
  // and rolled back, even though the request had already succeeded server-side.
  if (res.status === 204 || res.status === 205) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * A message safe to render for any error thrown by `apiFetch`.
 *
 * FastAPI answers validation failures (422) with `detail` as an *array* of
 * objects, not a string — rendering that as a React child throws, so anything
 * that isn't a plain string is replaced with a readable sentence.
 */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiError) {
    if (typeof err.detail === "string" && err.detail) return err.detail;
    if (err.status === 422) return "Some of your details look invalid. Please review them and try again.";
    if (err.status === 429) return "Too many requests. Please wait a moment and try again.";
    return fallback;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}
