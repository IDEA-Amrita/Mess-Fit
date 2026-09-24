import { test, expect, type Page, type Route } from "@playwright/test";
import { signIn } from "./support/session";

// Failed-to-load states, the route error boundary, and the 404 page.
// The backend is intercepted per test; nothing here needs real data.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

/** Answer every :8000 call with `respond(path)`, counting hits per path. */
async function mockApi(page: Page, respond: (path: string) => { status: number; body: unknown }) {
  const hits: Record<string, number> = {};
  await page.route("http://localhost:8000/**", async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    hits[path] = (hits[path] ?? 0) + 1;
    const { status, body } = respond(path);
    return route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });
  });
  return hits;
}

test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

test("unknown URLs show the branded 404 with a way back", async ({ page }) => {
  await page.goto("/definitely-not-a-page");
  await expect(page.getByRole("heading", { name: /couldn.t find that page/i })).toBeVisible();
  await page.getByRole("link", { name: "Go to dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a server error shows a plain-language message, not the raw detail, and Try again re-requests", async ({ page }) => {
  const hits = await mockApi(page, () => ({ status: 500, body: { detail: "Traceback: psycopg exploded" } }));
  await page.goto("/dashboard/progress");

  const alert = page.getByRole("alert").filter({ hasText: "Couldn't load progress" });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("Something went wrong on our side");
  await expect(alert).not.toContainText("Traceback");

  const before = hits["/api/v1/logs/progress"];
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => hits["/api/v1/logs/progress"]).toBeGreaterThan(before);
});

test("going offline while an error is showing says so", async ({ page, context }) => {
  await mockApi(page, () => ({ status: 500, body: { detail: "boom" } }));
  await page.goto("/dashboard/progress");
  const alert = page.getByRole("alert").filter({ hasText: "Couldn't load progress" });
  await expect(alert).toBeVisible();

  await context.setOffline(true);
  await expect(alert).toContainText("You're offline");
});

test("workout: a 409 about onboarding offers setup instead of retry", async ({ page }) => {
  await mockApi(page, (path) =>
    path === "/api/v1/workouts/today"
      ? { status: 409, body: { detail: "Complete onboarding before viewing workouts." } }
      : { status: 404, body: { detail: "not mocked" } },
  );
  await page.goto("/dashboard/workout");

  await expect(page.getByRole("heading", { name: "Finish setup first" })).toBeVisible();
  // Scoped: the dev overlay also echoes apiFetch's console.error text into the DOM.
  await expect(page.getByRole("alert").getByText("Complete onboarding before viewing workouts.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Set up profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
});

test("a render crash lands on the route error boundary", async ({ page }) => {
  // A malformed progress payload makes the page throw while rendering.
  await mockApi(page, (path) =>
    path === "/api/v1/logs/progress"
      ? { status: 200, body: { weight: "not-an-object", streak_days: {} } }
      : { status: 404, body: { detail: "not mocked" } },
  );
  await page.goto("/dashboard/progress");

  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to dashboard" })).toBeVisible();
});
