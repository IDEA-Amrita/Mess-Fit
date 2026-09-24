// Minimal Supabase Auth mock for e2e tests that need an authenticated session
// without reaching the real (unreachable-in-CI) Supabase project. Only the
// endpoints the app's proxy + client actually call are implemented — see
// apps/web/src/proxy.ts and apps/web/src/hooks/use-user.ts.
//
// Started by Playwright's webServer alongside `next dev` (see
// playwright.config.ts), which points NEXT_PUBLIC_SUPABASE_URL at this
// server for the e2e run only — .env.local's real project is untouched.
//
// Tests run in parallel against one server, so state is per *user*, never
// global: the fake access token carries `{ sub, onboarded }` (see
// tests/support/session.ts), and `PUT /auth/v1/user` remembers changes for
// that `sub` — which is how "finishing onboarding" survives the refresh that
// the proxy then reads. A token that doesn't decode gets the default,
// already-onboarded user.
import http from "node:http";

const PORT = 54321;

/** sub -> { onboarded?: boolean, meta: object } — overrides layered over the token's claims. */
const overrides = new Map();

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

function send(res, status, body) {
  res.writeHead(status, { ...CORS, "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function claimsFrom(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  } catch {
    return null;
  }
}

function userFor(sub, claims) {
  const o = overrides.get(sub) ?? { meta: {} };
  const onboarded = o.onboarded ?? claims?.onboarded ?? true;
  return {
    id: sub,
    aud: "authenticated",
    role: "authenticated",
    email: "e2e@messfit.local",
    app_metadata: { provider: "email" },
    user_metadata: { display_name: "E2E Tester", ...o.meta, onboarded },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: new Date().toISOString(),
  };
}

function sessionFor(sub, claims) {
  const user = userFor(sub, claims);
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = Buffer.from(JSON.stringify({ sub, onboarded: user.user_metadata.onboarded, exp })).toString("base64url");
  return {
    access_token: `mock.${payload}.sig`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: `refresh-${sub}`,
    user,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") return send(res, 204);

  const claims = claimsFrom(req);
  const sub = claims?.sub ?? "e2e-user-1";

  if (url.pathname === "/auth/v1/user" && req.method === "GET") return send(res, 200, userFor(sub, claims));

  if (url.pathname === "/auth/v1/user" && req.method === "PUT") {
    const body = await readBody(req);
    const o = overrides.get(sub) ?? { meta: {} };
    if (body.data) {
      const { onboarded, ...rest } = body.data;
      if (onboarded !== undefined) o.onboarded = !!onboarded;
      Object.assign(o.meta, rest);
      overrides.set(sub, o);
    }
    return send(res, 200, userFor(sub, claims));
  }

  if (url.pathname === "/auth/v1/token") {
    // Refresh: the refresh token is `refresh-<sub>`, which is what identifies the user.
    const body = await readBody(req);
    const refreshSub = typeof body.refresh_token === "string" ? body.refresh_token.replace(/^refresh-/, "") : sub;
    return send(res, 200, sessionFor(refreshSub, claims));
  }

  if (url.pathname === "/auth/v1/logout") return send(res, 204);

  return send(res, 404, { msg: "not mocked: " + url.pathname });
});

server.listen(PORT, () => console.log(`e2e supabase mock listening on :${PORT}`));
