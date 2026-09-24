import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./support/session";

// Client-side product analytics: what gets sent, when it must not be, and the
// admin usage page. The API is intercepted; nothing here needs a database.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

type Sent = { name: string; props: Record<string, unknown>; occurred_at: string };

const dish = (name: string) => ({
  dish_id: name, name, portions: 2, serving_unit: "pieces", portion_icon: "", grams: 100,
  kcal: 200, protein_g: 6, carbs_g: 40, fats_g: 1, reason: "",
});
const PLATE = {
  plan: { breakfast: [dish("Idli")], lunch: [], snack: [], dinner: [] },
  daily_totals: { kcal: 2000, protein_g: 100, carbs_g: 250, fats_g: 60 },
  daily_targets: { kcal: 2000, protein_g: 100, carbs_g: 250, fats_g: 60 },
  gap_fills: [], solver_status: "optimal", solve_time_ms: 5,
};

/** Capture analytics batches; answer the rest of the API from `extra`. */
async function mockApi(page: Page, extra: (method: string, path: string, url: URL) => { status: number; body: unknown } | undefined = () => undefined) {
  const sent: Sent[] = [];
  const requests: { authorization?: string; body: unknown }[] = [];
  await page.route("http://localhost:8000/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    if (url.pathname === "/api/v1/analytics/events") {
      const body = req.postDataJSON() as { events: Sent[] };
      requests.push({ authorization: req.headers()["authorization"], body });
      sent.push(...body.events);
      return route.fulfill({ status: 204, headers: CORS });
    }
    const r = extra(req.method(), url.pathname, url) ?? { status: 404, body: { detail: "not mocked" } };
    return route.fulfill({ status: r.status, headers: CORS, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return { sent, requests };
}

/** Force the batch out now instead of waiting for the 5s timer. */
const flush = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("pagehide")));

test.describe("collection", () => {
  test("a signed-in visit sends one session_start, attributed by token, with no identity in the body", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    const { sent, requests } = await mockApi(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("messfit:analytics-session"))).toBe("1");
    await flush(page);

    await expect.poll(() => sent.length).toBeGreaterThan(0);
    expect(sent.filter((e) => e.name === "session_start")).toHaveLength(1);
    expect(requests[0].authorization).toMatch(/^Bearer /);
    // The user is identified by the token alone; the payload names nobody.
    expect(JSON.stringify(requests[0].body)).not.toMatch(/user_id|email|e2e-/);

    // A reload in the same browser session is not a new session.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await flush(page);
    await page.waitForTimeout(500);
    expect(sent.filter((e) => e.name === "session_start")).toHaveLength(1);
  });

  test("viewing a plate sends plate_viewed once, with a slug prop, and a re-roll doesn't repeat it", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    const { sent } = await mockApi(page, (m, p) => (p === "/api/v1/optimize/today" ? { status: 200, body: PLATE } : undefined));
    await page.goto("/dashboard/plate");
    await expect(page.getByText("Idli")).toBeVisible();
    await page.getByRole("button", { name: "Re-roll" }).click();
    await expect(page.getByText("Idli")).toBeVisible();
    await flush(page);

    await expect.poll(() => sent.filter((e) => e.name === "plate_viewed").length).toBe(1);
    expect(sent.find((e) => e.name === "plate_viewed")!.props).toEqual({ source: "today" });
  });

  test("every event uses an allowed name and only short slug values", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    const { sent } = await mockApi(page, (m, p) => (p === "/api/v1/optimize/today" ? { status: 200, body: PLATE } : undefined));
    await page.goto("/dashboard/plate");
    await expect(page.getByText("Idli")).toBeVisible();
    await flush(page);
    await expect.poll(() => sent.length).toBeGreaterThan(1);

    const allowed = ["session_start", "onboarding_completed", "plate_viewed", "meal_logged", "weight_logged", "workout_saved", "chat_message_sent", "notifications_enabled", "pwa_installed", "article_opened"];
    for (const e of sent) {
      expect(allowed).toContain(e.name);
      for (const v of Object.values(e.props)) {
        if (typeof v === "string") expect(v).toMatch(/^[a-z0-9][a-z0-9_.:-]{0,63}$/);
      }
      expect(new Date(e.occurred_at).getTime()).not.toBeNaN();
    }
  });

  test("a signed-out visitor sends nothing", async ({ page }) => {
    const { requests } = await mockApi(page);
    await page.goto("/learn");
    await page.waitForLoadState("networkidle");
    await flush(page);
    await page.waitForTimeout(800);
    expect(requests).toHaveLength(0);
  });
});

test.describe("consent", () => {
  test("the in-app opt-out stops all collection and is remembered", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    const { requests } = await mockApi(page, (m, p) => (p === "/api/v1/optimize/today" ? { status: 200, body: PLATE } : undefined));
    await page.goto("/dashboard/settings");

    const toggle = page.getByRole("switch", { name: "Share usage data" });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem("messfit:analytics-optout"))).toBe("1");

    // Anything queued before the switch was thrown must be discarded, not sent late.
    await flush(page);
    await page.reload();
    await expect(page.getByRole("switch", { name: "Share usage data" })).not.toBeChecked();
    // plate_viewed is an event that WOULD fire here if collection were on.
    await page.goto("/dashboard/plate");
    await expect(page.getByText("Idli")).toBeVisible();
    await flush(page);
    await page.waitForTimeout(800);
    expect(requests).toHaveLength(0);
  });

  test("Do Not Track disables collection and explains why the switch is locked", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.addInitScript(() => Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true }));
    const { requests } = await mockApi(page, (m, p) => (p === "/api/v1/optimize/today" ? { status: 200, body: PLATE } : undefined));
    await page.goto("/dashboard/settings");

    await expect(page.getByRole("switch", { name: "Share usage data" })).toBeDisabled();
    await expect(page.getByText(/Do Not Track/)).toBeVisible();
    await page.goto("/dashboard/plate");
    await expect(page.getByText("Idli")).toBeVisible();
    await flush(page);
    await page.waitForTimeout(800);
    expect(requests).toHaveLength(0);
  });
});

test.describe("admin usage page", () => {
  const SUMMARY = {
    window_days: 14, total_events: 42, active_users_window: 5,
    dau: [{ day: "2026-09-23", users: 2 }, { day: "2026-09-24", users: 4 }],
    by_event: [{ name: "meal_logged", events: 20, users: 4 }, { name: "plate_viewed", events: 12, users: 5 }],
  };

  test.beforeEach(async ({ context, baseURL }) => signIn(context, baseURL!, { admin: true }));

  test("shows the headline numbers, daily actives and per-action usage in plain language", async ({ page }) => {
    await mockApi(page, (m, p) => (p === "/api/v1/analytics/summary" ? { status: 200, body: SUMMARY } : undefined));
    await page.goto("/admin/analytics");

    await expect(page.getByRole("heading", { name: "Usage" })).toBeVisible();
    await expect(page.getByText("Active students", { exact: true }).locator("xpath=..")).toContainText("5");
    await expect(page.getByRole("cell", { name: "Logged a meal" })).toBeVisible();
    await expect(page.getByText("2026-09-24")).toBeVisible();
  });

  test("the window buttons re-query with that many days", async ({ page }) => {
    const asked: string[] = [];
    await mockApi(page, (m, p, url) => {
      if (p !== "/api/v1/analytics/summary") return undefined;
      asked.push(url.searchParams.get("days")!);
      return { status: 200, body: SUMMARY };
    });
    await page.goto("/admin/analytics");
    await expect(page.getByRole("cell", { name: "Logged a meal" })).toBeVisible();
    await page.getByRole("button", { name: "30d" }).click();
    await expect.poll(() => asked).toContain("30");
  });

  test("empty and failed states are distinct", async ({ page }) => {
    let mode: "empty" | "fail" = "empty";
    await mockApi(page, (m, p) =>
      p === "/api/v1/analytics/summary"
        ? mode === "empty"
          ? { status: 200, body: { ...SUMMARY, total_events: 0, active_users_window: 0, dau: [], by_event: [] } }
          : { status: 500, body: { detail: "x" } }
        : undefined,
    );
    await page.goto("/admin/analytics");
    await expect(page.getByText("No usage recorded")).toBeVisible();

    mode = "fail";
    await page.getByRole("button", { name: "7d" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't load usage" })).toBeVisible();
  });
});
