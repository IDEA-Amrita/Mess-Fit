import { test, expect, type Page, type Route } from "@playwright/test";
import { gotoReady } from "./support/page";
import { signIn } from "./support/session";

// AI coach: streaming, sources, failure handling and history. The API is
// intercepted; answers arrive as server-sent events like the real endpoint's.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};
const NOW = "2026-10-05T09:00:00Z";
const conv = (id: string, title: string | null = null) => ({ id, title, created_at: NOW, updated_at: NOW });

const sse = (tokens: string[], done?: { citations: unknown[] }) =>
  tokens.map((t) => `data: ${JSON.stringify({ token: t })}\n\n`).join("") +
  (done ? `data: ${JSON.stringify({ done: true, ...done })}\n\n` : "");

const CITATIONS = [
  { chunk_id: "k1", source: "learn", title: "Cheap protein sources in India", slug: "cheap-protein-india" },
  { chunk_id: "k2", source: "learn", title: "Protein 101 for hostel students", slug: "protein-101" },
];

type Handler = (route: Route, method: string, body: unknown) => Promise<void> | void;

async function mockApi(page: Page, routes: Record<string, Handler>) {
  await page.route("http://localhost:8000/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    const handler = routes[path];
    if (handler) return handler(route, req.method(), req.postDataJSON?.() ?? null);
    return json(route, { detail: "not mocked" }, 404);
  });
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });
const stream = (route: Route, body: string) =>
  route.fulfill({ status: 200, headers: { ...CORS, "content-type": "text/event-stream" }, body });

const composer = (page: Page) => page.getByRole("textbox", { name: "Message" });
async function ask(page: Page, text: string) {
  await composer(page).fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

test("streams an answer and links its sources to the articles", async ({ page }) => {
  const created: string[] = [];
  const sent: unknown[] = [];
  await mockApi(page, {
    "/api/v1/chat/conversations": (route, method) => {
      if (method === "POST") {
        created.push("c1");
        return json(route, conv("c1"), 201);
      }
      return json(route, created.length ? [conv("c1", "Protein on a veg diet")] : []);
    },
    "/api/v1/chat/conversations/c1/messages": (route, method, body) => {
      if (method === "GET") return json(route, []);
      sent.push(body);
      return stream(route, sse(["Dal, curd ", "and paneer ", "cover it."], { citations: CITATIONS }));
    },
  });
  await gotoReady(page, "/dashboard/chat");

  await ask(page, "Enough protein on a veg diet?");
  const conversation = page.getByRole("log", { name: "Conversation" }).or(page.getByLabel("Conversation"));
  await expect(conversation.getByText("Dal, curd and paneer cover it.")).toBeVisible();
  await expect(conversation.getByText("Enough protein on a veg diet?")).toBeVisible();

  const sources = page.getByLabel("Sources");
  await expect(sources.getByRole("link", { name: /Cheap protein sources in India/ })).toHaveAttribute(
    "href",
    "/learn/cheap-protein-india",
  );
  await expect(sources.getByRole("link", { name: /Protein 101/ })).toHaveAttribute("href", "/learn/protein-101");
  expect(sent).toEqual([{ content: "Enough protein on a veg diet?" }]);
  await expect(composer(page)).toHaveValue("");

  // A follow-up stays in the same conversation instead of starting a new one.
  await ask(page, "And on a cut?");
  await expect(page.getByText("And on a cut?")).toBeVisible();
  await expect.poll(() => sent.length).toBe(2);
  expect(created).toHaveLength(1);
});

test("a rate-limited message can be retried", async ({ page }) => {
  let attempts = 0;
  await mockApi(page, {
    "/api/v1/chat/conversations": (route, method) =>
      method === "POST" ? json(route, conv("c1"), 201) : json(route, []),
    "/api/v1/chat/conversations/c1/messages": (route, method) => {
      if (method === "GET") return json(route, []);
      attempts += 1;
      if (attempts === 1) return json(route, { detail: "Rate limit exceeded" }, 429);
      return stream(route, sse(["Here you go."], { citations: [] }));
    },
  });
  await gotoReady(page, "/dashboard/chat");

  await ask(page, "How much water should I drink?");
  const alert = page.getByRole("alert").filter({ hasText: "sending messages too quickly" });
  await expect(alert).toBeVisible();

  await alert.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Here you go.")).toBeVisible();
  await expect(alert).toBeHidden();
  expect(attempts).toBe(2);
});

test("a dropped stream keeps the partial answer and says so", async ({ page }) => {
  await mockApi(page, {
    "/api/v1/chat/conversations": (route, method) =>
      method === "POST" ? json(route, conv("c1"), 201) : json(route, []),
    "/api/v1/chat/conversations/c1/messages": (route, method) =>
      method === "GET" ? json(route, []) : stream(route, sse(["Rest days matter because "])),
  });
  await gotoReady(page, "/dashboard/chat");

  await ask(page, "Why rest days?");
  await expect(page.getByText("Rest days matter because")).toBeVisible();
  const notice = page.getByRole("alert").filter({ hasText: "connection dropped" });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("opening a past conversation shows its messages", async ({ page }) => {
  await mockApi(page, {
    "/api/v1/chat/conversations": (route) => json(route, [conv("old", "Bulking on mess food")]),
    "/api/v1/chat/conversations/old/messages": (route) =>
      json(route, [
        { id: "m1", role: "user", content: "How do I bulk on mess food?", citations: [], created_at: NOW },
        {
          id: "m2",
          role: "assistant",
          content: "Add a katori of rice and curd at every meal.",
          citations: [CITATIONS[0]],
          created_at: NOW,
        },
      ]),
  });
  await gotoReady(page, "/dashboard/chat");

  await page.getByRole("navigation", { name: "Conversations" }).getByText("Bulking on mess food").click();
  await expect(page.getByText("How do I bulk on mess food?")).toBeVisible();
  await expect(page.getByText("Add a katori of rice and curd at every meal.")).toBeVisible();
  await expect(page.getByLabel("Sources").getByRole("link")).toHaveAttribute("href", "/learn/cheap-protein-india");
});
