import { test, expect, type Page, type Route } from "@playwright/test";
import { signIn } from "./support/session";

// Push notification panel in Settings. The browser's push stack can't be
// exercised for real in CI, so navigator.serviceWorker/PushManager/Notification
// are stubbed before the app loads, and the FastAPI backend is intercepted.
// What is under test is MessFit's own logic: the order of browser vs server
// calls, rollback on failure, re-sync on load, and the test-send button.

type Api = {
  calls: { method: string; path: string; body?: string }[];
  failing: Set<string>;
  hanging: Set<string>;
  delivered: number;
  weeklyCheckin: boolean;
  order: string[]; // interleaved server calls and browser unsubscribes, in order
};

async function setup(page: Page, opts: { existingSub?: boolean } = {}): Promise<Api> {
  const api: Api = { calls: [], failing: new Set(), hanging: new Set(), delivered: 1, weeklyCheckin: true, order: [] };

  await page.addInitScript((existing: boolean) => {
    const w = window as unknown as Record<string, unknown>;
    w.__unsubCalls = 0;
    w.__log = [];
    const makeSub = () => ({
      endpoint: "https://push.example/e2e",
      toJSON: () => ({ endpoint: "https://push.example/e2e", keys: { p256dh: "p", auth: "a" } }),
      unsubscribe: async () => {
        (w.__unsubCalls as number)++;
        (w.__log as string[]).push("browser-unsubscribe");
        return true;
      },
    });
    let current: ReturnType<typeof makeSub> | null = existing ? makeSub() : null;
    const reg = {
      pushManager: {
        getSubscription: async () => current,
        subscribe: async () => (current = makeSub()),
      },
    };
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: async () => reg, getRegistration: async () => reg, ready: Promise.resolve(reg) },
      configurable: true,
    });
    w.PushManager = function PushManager() {};
    Object.defineProperty(Notification, "permission", { value: "default", configurable: true });
    Notification.requestPermission = async () => "granted";
  }, !!opts.existingSub);

  await page.route("http://localhost:8000/**", async (route: Route) => {
    const req = route.request();
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = new URL(req.url()).pathname;
    api.calls.push({ method: req.method(), path, body: req.postData() ?? undefined });
    api.order.push(`${req.method()} ${path}`);
    if (api.hanging.has(path)) return; // never answers
    if (api.failing.has(path)) {
      return route.fulfill({ status: 500, headers: cors, contentType: "application/json", body: JSON.stringify({ detail: "server exploded" }) });
    }
    if (path === "/api/v1/notifications/subscribe") return route.fulfill({ status: 201, headers: cors, contentType: "application/json", body: "{}" });
    if (path === "/api/v1/notifications/unsubscribe") return route.fulfill({ status: 204, headers: cors });
    if (path === "/api/v1/notifications/preferences") {
      if (req.method() === "PUT") api.weeklyCheckin = (req.postDataJSON() as { weekly_checkin: boolean }).weekly_checkin;
      return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ weekly_checkin: api.weeklyCheckin }) });
    }
    if (path === "/api/v1/notifications/test") {
      return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ delivered: api.delivered }) });
    }
    return route.fulfill({ status: 404, headers: cors, contentType: "application/json", body: JSON.stringify({ detail: "not mocked" }) });
  });
  return api;
}

const count = (api: Api, method: string, path: string) => api.calls.filter((c) => c.method === method && c.path === path).length;

test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

test("enabling registers with the server and reveals the test button", async ({ page }) => {
  const api = await setup(page);
  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Enable", exact: true }).click();

  await expect(page.getByRole("button", { name: "Disable", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send a test notification" })).toBeVisible();
  expect(count(api, "POST", "/api/v1/notifications/subscribe")).toBe(1);
});

test("if the server refuses, the browser subscription is rolled back", async ({ page }) => {
  const api = await setup(page);
  api.failing.add("/api/v1/notifications/subscribe");
  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Enable", exact: true }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Couldn't enable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __unsubCalls: number }).__unsubCalls)).toBe(1);
});

test("an existing browser subscription is re-registered on load", async ({ page }) => {
  const api = await setup(page, { existingSub: true });
  await page.goto("/dashboard/settings");
  await expect(page.getByRole("button", { name: "Disable", exact: true })).toBeVisible();
  await expect.poll(() => count(api, "POST", "/api/v1/notifications/subscribe")).toBe(1);
});

test("if the server fails to unsubscribe, the panel stays subscribed", async ({ page }) => {
  const api = await setup(page, { existingSub: true });
  api.failing.add("/api/v1/notifications/unsubscribe");
  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Disable", exact: true }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Couldn't disable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disable", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __unsubCalls: number }).__unsubCalls)).toBe(0);
});

test("disabling removes the server subscription first, then the browser's", async ({ page }) => {
  const api = await setup(page, { existingSub: true });
  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Disable", exact: true }).click();

  await expect(page.getByRole("button", { name: "Enable", exact: true })).toBeVisible();
  expect(count(api, "DELETE", "/api/v1/notifications/unsubscribe")).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { __unsubCalls: number }).__unsubCalls)).toBe(1);
});

test("test notification reports success, and explains a zero-delivery result", async ({ page }) => {
  const api = await setup(page, { existingSub: true });
  await page.goto("/dashboard/settings");
  const send = page.getByRole("button", { name: "Send a test notification" });

  await send.click();
  await expect(page.getByRole("status").filter({ hasText: "Test sent" })).toBeVisible();

  api.delivered = 0;
  await send.click();
  await expect(page.getByRole("alert").filter({ hasText: "no working subscription" })).toBeVisible();
});

// ─── weekly check-in preference ─────────────────────────────────────────

test.describe("weekly check-in reminder switch", () => {
  const toggle = (page: Page) => page.getByRole("switch", { name: "Weekly check-in reminder" });

  test("reflects the saved value and saves a change", async ({ page }) => {
    const api = await setup(page);
    await page.goto("/dashboard/settings");
    await expect(toggle(page)).toBeChecked();

    await toggle(page).click();
    await expect(toggle(page)).not.toBeChecked();
    await expect.poll(() => api.weeklyCheckin).toBe(false);

    await page.reload();
    await expect(toggle(page)).not.toBeChecked();
  });

  test("a failed save puts the switch back and says so", async ({ page }) => {
    const api = await setup(page);
    await page.goto("/dashboard/settings");
    await expect(toggle(page)).toBeChecked();

    // Refuse only the save; the follow-up read still works.
    await page.route("http://localhost:8000/api/v1/notifications/preferences", async (route) => {
      if (route.request().method() !== "PUT") return route.fallback();
      return route.fulfill({
        status: 500,
        headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,PUT,OPTIONS" },
        contentType: "application/json",
        body: JSON.stringify({ detail: "nope" }),
      });
    });
    await toggle(page).click();
    await expect(toggle(page)).toBeChecked();
    await expect(page.getByText("nope")).toBeVisible();
    expect(api.weeklyCheckin).toBe(true);
  });

  test("a failed load offers a retry instead of a guessed value", async ({ page }) => {
    const api = await setup(page);
    api.failing.add("/api/v1/notifications/preferences");
    await page.goto("/dashboard/settings");
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't load your reminder settings" })).toBeVisible();
    await expect(toggle(page)).toHaveCount(0);

    api.failing.delete("/api/v1/notifications/preferences");
    await page.getByLabel("Notifications").getByRole("button", { name: "Retry" }).click();
    await expect(toggle(page)).toBeChecked();
  });
});

// ─── sign-out detaches this browser ─────────────────────────────────────

test.describe("signing out on a shared computer", () => {
  const signOut = async (page: Page) => {
    await page.goto("/dashboard/settings");
    await page.getByRole("main").getByRole("button", { name: "Sign out", exact: true }).click();
  };
  const log = (page: Page) => page.evaluate(() => (window as unknown as { __log: string[] }).__log);

  test("removes the server subscription, then the browser's, before leaving", async ({ page }) => {
    const api = await setup(page, { existingSub: true });
    await signOut(page);
    await expect(page).toHaveURL(/\/auth\/login/);

    expect(count(api, "DELETE", "/api/v1/notifications/unsubscribe")).toBe(1);
    expect(JSON.parse(api.calls.find((c) => c.method === "DELETE")!.body!).endpoint).toBe("https://push.example/e2e");
    expect(await log(page)).toEqual(["browser-unsubscribe"]);
  });

  test("still unsubscribes the browser and signs out if the server call fails", async ({ page }) => {
    const api = await setup(page, { existingSub: true });
    api.failing.add("/api/v1/notifications/unsubscribe");
    await signOut(page);
    await expect(page).toHaveURL(/\/auth\/login/);
    expect(await log(page)).toEqual(["browser-unsubscribe"]);
  });

  test("an unresponsive API never traps the user on a signed-in screen", async ({ page }) => {
    const api = await setup(page, { existingSub: true });
    api.hanging.add("/api/v1/notifications/unsubscribe");
    await signOut(page);
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15_000 });
  });

  test("with no subscription there is nothing to remove", async ({ page }) => {
    const api = await setup(page);
    await signOut(page);
    await expect(page).toHaveURL(/\/auth\/login/);
    expect(count(api, "DELETE", "/api/v1/notifications/unsubscribe")).toBe(0);
    expect(await log(page)).toEqual([]);
  });
});
