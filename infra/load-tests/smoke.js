// Smoke test (Phase 9, task 9.5): a single VU sanity-checks the API is up and
// the auth flow works before running a heavier load profile.
//
//   k6 run --env API_URL=https://staging-api.messfit.app \
//           --env AUTH_TOKEN=<supabase-jwt> infra/load-tests/smoke.js
import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

const API_URL = __ENV.API_URL || "http://localhost:8000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";

export default function () {
  const health = http.get(`${API_URL}/health`);
  check(health, {
    "health 200": (r) => r.status === 200,
    "health ok": (r) => r.json("status") === "ok",
  });

  if (AUTH_TOKEN) {
    const me = http.get(`${API_URL}/api/v1/me`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    check(me, { "me 200": (r) => r.status === 200 });
  }
}
