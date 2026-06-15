// Optimizer load test (Phase 9, task 9.5).
//
// Ramps to 100 concurrent VUs hitting POST /api/v1/optimize/today and enforces
// the PRD budget: p95 < 500ms and <1% errors. Run against STAGING, never prod —
// the optimizer is CPU-heavy and will hammer a free-tier DB.
//
//   k6 run --env API_URL=https://staging-api.messfit.app \
//           --env AUTH_TOKEN=<supabase-jwt> infra/load-tests/optimizer.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    optimizer_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 50 },
        { duration: "3m", target: 100 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const API_URL = __ENV.API_URL || "http://localhost:8000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";

export default function () {
  const res = http.post(`${API_URL}/api/v1/optimize/today`, null, {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  check(res, {
    "status 200": (r) => r.status === 200,
    "p95 < 500ms": (r) => r.timings.duration < 500,
  });
  sleep(1);
}
