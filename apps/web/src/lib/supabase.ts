/**
 * Browser-side Supabase client.
 *
 * Used in "use client" components for auth actions (login, signup,
 * signOut, getSession). Session tokens are stored in cookies managed
 * by the middleware — this client reads them automatically.
 */

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — check apps/web/.env.local",
  );
}

export const supabase = createBrowserClient(url, anonKey);
