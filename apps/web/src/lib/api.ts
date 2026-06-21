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

  return res.json() as Promise<T>;
}
