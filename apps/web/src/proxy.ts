/**
 * Next.js Proxy (formerly Middleware) — the SINGLE source of truth for route protection.
 *
 * Runs server-side before every matched request. Makes ALL routing
 * decisions based on:
 *   1. Whether the user is authenticated (Supabase JWT in cookie)
 *   2. Whether they've completed onboarding (user_metadata.onboarded)
 *
 * Both signals come from the JWT itself — no backend call needed,
 * no client-side flicker, no race conditions.
 *
 * Routing matrix:
 *
 *   ┌──────────────┬──────────────────┬──────────────────────────────┐
 *   │  Auth state  │  Path            │  Action                       │
 *   ├──────────────┼──────────────────┼──────────────────────────────┤
 *   │  guest       │  public          │  allow                        │
 *   │  guest       │  protected       │  redirect /auth/login         │
 *   │  authed off  │  /auth/*         │  redirect /onboarding/profile │
 *   │  authed off  │  /onboarding/*   │  allow                        │
 *   │  authed off  │  /dashboard/*    │  redirect /onboarding/profile │
 *   │  authed on   │  /auth/*         │  redirect /dashboard          │
 *   │  authed on   │  /onboarding/*   │  redirect /dashboard          │
 *   │  authed on   │  /dashboard/*    │  allow                        │
 *   └──────────────┴──────────────────┴──────────────────────────────┘
 *
 *   "off" = onboarding NOT complete · "on" = onboarding complete
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes anyone can access without authentication.
const PUBLIC_ROUTES = new Set([
  "/",
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/callback",
]);

// The /learn articles are public and deep-linkable (chatbot citations link here).
function isLearn(pathname: string): boolean {
  return pathname === "/learn" || pathname.startsWith("/learn/");
}

// Legal pages must be reachable by anyone, including not-onboarded users.
function isLegal(pathname: string): boolean {
  return pathname === "/privacy" || pathname === "/terms";
}

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname) || isLearn(pathname) || isLegal(pathname);
}

function isAuthRoute(pathname: string): boolean {
  return pathname.startsWith("/auth/");
}

function isOnboardingRoute(pathname: string): boolean {
  return pathname.startsWith("/onboarding");
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

/**
 * Server-verified admin check for /admin/* routes.
 *
 * Deliberately NOT read from the JWT: role lives only in the users table
 * (there's no sync into Supabase user_metadata/app_metadata), and the
 * backend's own require_admin dependency already treats the DB as the sole
 * source of truth for roles — this mirrors that rule instead of trusting a
 * claim that doesn't exist. Fails closed: any error means "not admin."
 */
async function isAdmin(accessToken: string): Promise<boolean> {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/api/v1/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return false;
    const body = await res.json();
    return body.role === "admin";
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for the OAuth callback page — it needs to run
  // client-side first to exchange the code for a session.
  if (pathname === "/auth/callback") {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Get the current user — this also rotates expired access tokens.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─── Guest (not logged in) ────────────────────────────────────────
  if (!user) {
    if (isPublic(pathname)) return response;

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    return NextResponse.redirect(loginUrl);
  }

  // ─── Authenticated ────────────────────────────────────────────────
  const onboarded = Boolean(user.user_metadata?.onboarded);

  // Admin-only routes: verify the role server-side before anything else.
  // There was previously no gate here at all — any onboarded student could
  // reach /admin/ocr and the full menu-approval flow.
  if (isAdminRoute(pathname)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const allowed = session?.access_token ? await isAdmin(session.access_token) : false;
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Logged in users on auth pages → bounce them out. Exception: the recovery
  // link signs the user in, and they must still be able to set the new password.
  if (isAuthRoute(pathname) && pathname !== "/auth/reset-password") {
    const url = request.nextUrl.clone();
    url.pathname = onboarded ? "/dashboard" : "/onboarding/profile";
    return NextResponse.redirect(url);
  }

  // Onboarded user trying to revisit onboarding → bounce to dashboard.
  // Exceptions:
  //   /onboarding/targets — shown right after onboarding completes
  //   /onboarding/hostel  — doubles as "update mess / hostel context" for
  //                         users who need to fix or change their mess
  if (
    onboarded &&
    isOnboardingRoute(pathname) &&
    pathname !== "/onboarding/targets" &&
    pathname !== "/onboarding/hostel"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // NOT-onboarded user trying to access anything other than onboarding
  // → bounce to onboarding/profile
  if (
    !onboarded &&
    !isOnboardingRoute(pathname) &&
    pathname !== "/auth/reset-password" &&
    pathname !== "/" &&
    !isLearn(pathname) &&
    !isLegal(pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding/profile";
    return NextResponse.redirect(url);
  }

  return response;
}

// Match everything except static assets and Next internals.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
