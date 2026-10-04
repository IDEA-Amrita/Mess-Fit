import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { gotoReady } from "../../tests/support/page";
import { signIn } from "../../tests/support/session";
import * as F from "./fixtures";

// Regenerates the screenshots in docs/assets/readme/screens/ against mocked
// data (see fixtures.ts). Not part of the e2e suite; run with:
//   pnpm exec playwright test -c playwright.readme.config.ts

const OUT = path.resolve(__dirname, "../../../../docs/assets/readme/screens");
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};
const CONV = { id: "c1", title: "Vegetarian protein", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

const USER = { displayName: "Priya Raman", email: "priya@messfit.app" };

async function mockApi(page: Page) {
  // The browser asks the auth mock who is signed in; answer as the demo student.
  await page.route("http://localhost:54321/auth/v1/user", (route) =>
    route.fulfill({
      status: 200,
      headers: CORS,
      contentType: "application/json",
      body: JSON.stringify({
        id: "readme",
        aud: "authenticated",
        role: "authenticated",
        email: USER.email,
        user_metadata: { display_name: USER.displayName, onboarded: true },
        app_metadata: {},
        created_at: "2026-08-01T00:00:00Z",
      }),
    }),
  );
  await page.route("http://localhost:8000/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });

    switch (url.pathname) {
      case "/api/v1/me":
        return json({ id: "readme", role: "user" });
      case "/api/v1/optimize/today":
        return json(F.PLATE);
      case "/api/v1/logs/today":
        return json(F.TODAY_LOGS);
      case "/api/v1/logs/progress":
        return json(F.progress(url.searchParams.get("range") ?? "30d"));
      case "/api/v1/logs/leaderboard":
        return json(F.LEADERBOARD);
      case "/api/v1/workouts/today":
        return json(F.WORKOUT);
      case "/api/v1/chat/conversations":
        return req.method() === "POST" ? json(CONV, 201) : json([]);
      case "/api/v1/chat/conversations/c1/messages": {
        if (req.method() === "GET") return json([]);
        const words = F.CHAT_ANSWER.split(/(?<= )/);
        const events = words.map((t) => `data: ${JSON.stringify({ token: t })}\n\n`).join("");
        return route.fulfill({
          status: 200,
          headers: { ...CORS, "content-type": "text/event-stream" },
          body: events + `data: ${JSON.stringify({ done: true, citations: F.CHAT_CITATIONS })}\n\n`,
        });
      }
      case "/mess/dishes/feedback":
        return json({ dish_id: url.searchParams.get("dish_id"), confirms: 0, denies: 0 });
      default:
        console.warn(`[readme-shots] unmocked ${req.method()} ${url.pathname}`);
        return json({ detail: "not mocked" }, 404);
    }
  });
}

/** Let entrance animations and count-ups finish before the capture. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_000);
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

test.beforeEach(async ({ context, baseURL, page }) => {
  await signIn(context, baseURL!, USER);
  await mockApi(page);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });

  test("today", async ({ page }) => {
    await gotoReady(page, "/dashboard");
    await shot(page, "phone-today");
  });

  test("plate", async ({ page }) => {
    await gotoReady(page, "/dashboard/plate");
    await expect(page.getByText("Idli").first()).toBeVisible();
    await shot(page, "phone-plate");
  });

  test("progress", async ({ page }) => {
    await gotoReady(page, "/dashboard/progress");
    await page.getByRole("group", { name: "Time range" }).getByRole("button", { name: "30d" }).click();
    await shot(page, "phone-progress");
  });

  test("workout", async ({ page }) => {
    await gotoReady(page, "/dashboard/workout");
    await expect(page.getByText("Push-ups").first()).toBeVisible();
    await shot(page, "phone-workout");
  });

  test("coach", async ({ page }) => {
    await gotoReady(page, "/dashboard/chat");
    const box = page.getByRole("textbox").last();
    await box.fill(F.CHAT_QUESTION);
    await box.press("Enter");
    await expect(page.getByText("Cheap protein sources in India").first()).toBeVisible();
    await shot(page, "phone-coach");
  });

  test("log", async ({ page }) => {
    await gotoReady(page, "/dashboard/log");
    await shot(page, "phone-log");
  });
});

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });

  test("today", async ({ page }) => {
    await gotoReady(page, "/dashboard");
    await shot(page, "desktop-today");
  });

  test("plate", async ({ page }) => {
    await gotoReady(page, "/dashboard/plate");
    await expect(page.getByText("Idli").first()).toBeVisible();
    await shot(page, "desktop-plate");
  });
});
