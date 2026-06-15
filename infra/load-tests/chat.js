// Chatbot load test (Phase 9, task 9.5).
//
// Exercises the RAG chat path under load and tracks first-token latency from the
// SSE stream. The endpoint streams text/event-stream, so we read the full body
// and measure time-to-first-"data:" as a first-token proxy. Run against STAGING.
//
//   k6 run --env API_URL=https://staging-api.messfit.app \
//           --env AUTH_TOKEN=<supabase-jwt> infra/load-tests/chat.js
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const firstTokenMs = new Trend("chat_first_token_ms", true);

export const options = {
  scenarios: {
    chat_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 20 },
        { duration: "3m", target: 40 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    // Chatbot is LLM-bound; first token should still arrive promptly.
    chat_first_token_ms: ["p(95)<3000"],
  },
};

const API_URL = __ENV.API_URL || "http://localhost:8000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";
const QUESTIONS = [
  "How much protein should I eat to build muscle?",
  "Is mess rice bad for cutting?",
  "What are cheap protein sources in an Indian hostel?",
];

function authHeaders() {
  return {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export default function () {
  // One conversation per iteration, then a streamed message.
  const conv = http.post(`${API_URL}/api/v1/chat/conversations`, null, {
    headers: authHeaders(),
  });
  if (!check(conv, { "conversation 201": (r) => r.status === 201 })) {
    return;
  }
  const convId = conv.json("id");
  const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];

  const start = Date.now();
  const res = http.post(
    `${API_URL}/api/v1/chat/conversations/${convId}/messages`,
    JSON.stringify({ content: q }),
    { headers: authHeaders() },
  );
  // Whole SSE body is buffered by k6; approximate first-token as response time.
  firstTokenMs.add(Date.now() - start);
  check(res, {
    "message 200": (r) => r.status === 200,
    "got tokens": (r) => typeof r.body === "string" && r.body.includes("data:"),
  });
  sleep(2);
}
