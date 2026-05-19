/**
 * Server-side Supabase client.
 *
 * Used in Server Components, Route Handlers, and Server Actions.
 * Reads the session from cookies (set by middleware).
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // In Server Components we can't set cookies — that's fine,
            // the middleware handles refresh. Swallow the error.
          }
        },
      },
    },
  );
}
