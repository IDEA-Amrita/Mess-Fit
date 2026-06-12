/**
 * Next.js Middleware — the SINGLE source of truth for route protection.
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
const PUBLIC_ROUTES = new Set(["/", "/auth/login", "/auth/signup", "/auth/callback"]);

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}

function isAuthRoute(pathname: string): boolean {
  return pathname.startsWith("/auth/");
}

function isOnboardingRoute(pathname: string): boolean {
  return pathname.startsWith("/onboarding");
}

export async function middleware(request: NextRequest) {
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

  // Logged in users on auth pages → bounce them out
  if (isAuthRoute(pathname)) {
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
  if (!onboarded && !isOnboardingRoute(pathname) && pathname !== "/") {
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
