import type { BrowserContext } from "@playwright/test";

/**
 * Injects a fake Supabase session cookie so tests can reach authenticated
 * routes without a real login flow. @supabase/ssr's browser/server clients
 * both read the session from a cookie named `sb-<project-ref>-auth-token`,
 * where the ref is derived from NEXT_PUBLIC_SUPABASE_URL's hostname — for
 * the e2e mock (http://localhost:54321, see tests/mocks/auth-server.mjs)
 * that ref is "localhost". Neither client verifies the JWT signature
 * client-side, so a well-formed but unsigned token is enough here.
 */
export async function signIn(context: BrowserContext, baseURL: string) {
  const session = {
    access_token: "mock.tok.sig",
    refresh_token: "refresh-e2e",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: "e2e-user-1",
      email: "e2e@messfit.local",
      user_metadata: { display_name: "E2E Tester", onboarded: true },
    },
  };
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  await context.addCookies([{ name: "sb-localhost-auth-token", value, url: baseURL }]);
}
