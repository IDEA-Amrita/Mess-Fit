// Minimal Supabase Auth mock for e2e tests that need an authenticated session
// without reaching the real (unreachable-in-CI) Supabase project. Only the
// endpoints the app's middleware + client actually call are implemented —
// see apps/web/src/middleware.ts and apps/web/src/hooks/use-user.ts.
//
// Started by Playwright's webServer alongside `next dev` (see
// playwright.config.ts), which points NEXT_PUBLIC_SUPABASE_URL at this
// server for the e2e run only — .env.local's real project is untouched.
import http from "node:http";

const PORT = 54321;

const user = {
  id: "e2e-user-1",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e@messfit.local",
  app_metadata: { provider: "email" },
  user_metadata: { display_name: "E2E Tester", onboarded: true },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: new Date().toISOString(),
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

function send(res, status, body) {
  res.writeHead(status, { ...CORS, "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

function sessionJson() {
  return {
    access_token: "mock." + Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url") + ".sig",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "refresh-e2e",
    user,
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") return send(res, 204);

  if (url.pathname === "/auth/v1/user" && req.method === "GET") return send(res, 200, user);
  if (url.pathname === "/auth/v1/token") return send(res, 200, sessionJson());
  if (url.pathname === "/auth/v1/logout") return send(res, 204);

  return send(res, 404, { msg: "not mocked: " + url.pathname });
});

server.listen(PORT, () => console.log(`e2e supabase mock listening on :${PORT}`));
