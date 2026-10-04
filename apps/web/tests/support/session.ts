import { randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";

/**
 * Injects a fake Supabase session cookie so tests can reach authenticated
 * routes without a real login flow. @supabase/ssr's browser/server clients
 * both read the session from a cookie named `sb-<project-ref>-auth-token`,
 * where the ref is derived from NEXT_PUBLIC_SUPABASE_URL's hostname — for
 * the e2e mock (http://localhost:54321, see tests/mocks/auth-server.mjs)
 * that ref is "localhost". Neither client verifies the JWT signature
 * client-side, so a well-formed but unsigned token is enough here.
 *
 * The access token carries `{ sub, onboarded }`, which the mock reads back.
 * Pass `onboarded: false` for a brand-new user; give each test its own `sub`
 * (the default is unique) so parallel tests never share mock state.
 * `admin: true` makes the sub start with "admin", which tests/mocks/api-server.mjs
 * reports as role=admin to the proxy's /admin/* gate.
 */
export async function signIn(
  context: BrowserContext,
  baseURL: string,
  opts: { onboarded?: boolean; sub?: string; admin?: boolean; displayName?: string; email?: string } = {},
) {
  const sub = opts.sub ?? `${opts.admin ? "admin" : "e2e"}-${randomUUID()}`;
  const onboarded = opts.onboarded ?? true;
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const claims = Buffer.from(JSON.stringify({ sub, onboarded, exp })).toString("base64url");
  const session = {
    access_token: `mock.${claims}.sig`,
    refresh_token: `refresh-${sub}`,
    expires_in: 3600,
    expires_at: exp,
    token_type: "bearer",
    user: {
      id: sub,
      email: opts.email ?? "e2e@messfit.local",
      user_metadata: { display_name: opts.displayName ?? "E2E Tester", onboarded },
    },
  };
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  await context.addCookies([{ name: "sb-localhost-auth-token", value, url: baseURL }]);
  return { sub };
}
