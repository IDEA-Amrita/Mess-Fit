import { test, expect, type Page } from "@playwright/test";
import { gotoReady } from "./support/page";
import { signIn } from "./support/session";

// Stateful interactions that were rewritten off effect-driven state: the rest
// timer's clock, the weight prefill + "Saved" confirmation, and the mobile
// "More" sheet. The API is intercepted; the clock is controlled where it matters.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};
const TODAY = "2026-09-29";

async function mockApi(page: Page, routes: Record<string, (method: string, body: unknown) => { status: number; body?: unknown }>) {
  await page.route("http://localhost:8000/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    const handler = routes[path];
    const r = handler ? handler(req.method(), req.postDataJSON?.() ?? null) : { status: 404, body: { detail: "not mocked" } };
    return route.fulfill({ status: r.status, headers: CORS, contentType: "application/json", body: JSON.stringify(r.body ?? {}) });
  });
}

test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

// ─── rest timer ──────────────────────────────────────────────────────────

const WORKOUT = {
  template_id: "t1", template_name: "Hostel Full Body", goal: "maintain", week: 1, day: 1, day_name: "Day 1",
  exercises: [
    {
      exercise_id: "e1", name: "Push-ups", primary_muscle: "chest", sets: 3, reps: "10", rest_seconds: 30,
      youtube_video_id: null, instruction_text: null, common_mistakes: [],
    },
  ],
};
const EMPTY_DAY = { date: TODAY, meals: [], weight: null, subjective: null, workout_status: null };

test.describe("rest timer", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(`${TODAY}T10:00:00+05:30`) });
    await mockApi(page, {
      "/api/v1/workouts/today": () => ({ status: 200, body: WORKOUT }),
      "/api/v1/logs/today": () => ({ status: 200, body: EMPTY_DAY }),
    });
    await gotoReady(page, "/dashboard/workout");
    await page.getByRole("button", { name: "Complete set 1 of Push-ups" }).click();
  });

  const timer = (page: Page) => page.getByRole("dialog", { name: "Rest timer" });

  test("counts down from the exercise's rest time", async ({ page }) => {
    await expect(timer(page)).toBeVisible();
    await expect(timer(page).getByRole("timer")).toHaveText("30");
    await page.clock.runFor(10_000);
    await expect(timer(page).getByRole("timer")).toHaveText("20");
  });

  test("+15s extends the countdown instead of restarting it", async ({ page }) => {
    await page.clock.runFor(10_000);
    await expect(timer(page).getByRole("timer")).toHaveText("20");
    await timer(page).getByRole("button", { name: "15s" }).click();
    await expect(timer(page).getByRole("timer")).toHaveText("35");
  });

  test("skip closes it immediately", async ({ page }) => {
    await timer(page).getByRole("button", { name: "Skip rest" }).click();
    await expect(timer(page)).toBeHidden();
  });
});

// Closing itself is checked in real time: under the fake clock framer-motion's
// exit animation never completes, which isn't what a real device does.
test("the rest timer closes itself when the rest is over", async ({ page }) => {
  await mockApi(page, {
    "/api/v1/workouts/today": () => ({
      status: 200,
      body: { ...WORKOUT, exercises: [{ ...WORKOUT.exercises[0], rest_seconds: 2 }] },
    }),
    "/api/v1/logs/today": () => ({ status: 200, body: EMPTY_DAY }),
  });
  await gotoReady(page, "/dashboard/workout");
  await page.getByRole("button", { name: "Complete set 1 of Push-ups" }).click();
  const timer = page.getByRole("dialog", { name: "Rest timer" });
  await expect(timer).toBeVisible();
  await expect(timer).toBeHidden({ timeout: 8_000 });
});

// ─── weight ──────────────────────────────────────────────────────────────

test.describe("weight", () => {
  test("prefills today's saved weight, saves an edit, and confirms briefly", async ({ page }) => {
    const saved: unknown[] = [];
    await mockApi(page, {
      "/api/v1/logs/today": () => ({
        status: 200,
        body: { ...EMPTY_DAY, weight: { date: TODAY, weight_kg: 61.5, created_at: `${TODAY}T08:00:00Z` } },
      }),
      "/api/v1/optimize/today": () => ({ status: 404, body: { detail: "none" } }),
      "/api/v1/logs/weight": (_m, body) => {
        saved.push(body);
        return { status: 201, body: { date: TODAY, weight_kg: (body as { weight_kg: number }).weight_kg } };
      },
    });
    await gotoReady(page, "/dashboard/log");
    await page.getByRole("tab", { name: "Weight" }).click();

    const input = page.getByLabel("Weight in kilograms");
    await expect(input).toHaveValue("61.5");

    await input.fill("62");
    await page.getByRole("button", { name: "Save weight" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    expect(saved).toEqual([expect.objectContaining({ weight_kg: 62 })]);
    // The confirmation is brief, and what they typed isn't replaced by a refetch.
    await expect(page.getByRole("button", { name: "Save weight" })).toBeVisible({ timeout: 5_000 });
    await expect(input).toHaveValue("62");
  });
});

// ─── mobile "More" sheet ─────────────────────────────────────────────────

test.describe("mobile More sheet", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await mockApi(page, {});
    await gotoReady(page, "/dashboard");
  });

  const sheet = (page: Page) => page.getByRole("dialog").filter({ hasText: "More" });
  const moreButton = (page: Page) => page.getByRole("button", { name: "More", exact: true });

  test("closes when you navigate from it, and stays closed when you come back", async ({ page }) => {
    await moreButton(page).click();
    await expect(sheet(page)).toBeVisible();
    await sheet(page).getByRole("link", { name: "Workout" }).click();
    await expect(page).toHaveURL(/\/dashboard\/workout$/);
    await expect(sheet(page)).toBeHidden();

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(sheet(page)).toBeHidden();
  });

  test("Escape closes it and returns focus to the More button", async ({ page }) => {
    await moreButton(page).click();
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();
    await expect(moreButton(page)).toBeFocused();
  });
});
