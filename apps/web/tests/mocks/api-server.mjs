// Tiny stand-in for the FastAPI backend, for the one thing browser-level
// mocking (page.route) can't reach: the proxy's *server-side* admin check
// (src/proxy.ts calls GET /api/v1/me before letting anyone into /admin/*).
//
// Everything else is answered 404 so a test that forgets to intercept a call
// fails loudly instead of hanging; tests mock real endpoints with page.route.
// Admin is decided by the token's `sub`: it must start with "admin".
import http from "node:http";

const PORT = 8000;
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

function subFrom(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub ?? "";
  } catch {
    return "";
  }
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      return res.end();
    }
    res.setHeader("content-type", "application/json");
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    if (url.pathname === "/api/v1/me") {
      const sub = subFrom(req);
      res.writeHead(200);
      return res.end(JSON.stringify({ id: sub, role: sub.startsWith("admin") ? "admin" : "user" }));
    }
    res.writeHead(404);
    res.end(JSON.stringify({ detail: "not mocked: " + url.pathname }));
  })
  .listen(PORT, () => console.log(`e2e api mock listening on :${PORT}`));
