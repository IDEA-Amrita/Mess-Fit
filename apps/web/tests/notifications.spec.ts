import { test, expect, type Page, type Route } from "@playwright/test";
import { signIn } from "./support/session";

// Push notification panel in Settings. The browser's push stack can't be
// exercised for real in CI, so navigator.serviceWorker/PushManager/Notification
// are stubbed before the app loads, and the FastAPI backend is intercepted.
// What is under test is MessFit's own logic: the order of browser vs server
// calls, rollback on failure, re-sync on load, and the test-send button.

type Api = { calls: { method: string; path: string }[]; failing: Set<string>; delivered: number };

async function setup(page: Page, opts: { existingSub?: boolean } = {}): Promise<Api> {
  const api: Api = { calls: [], failing: new Set(), delivered: 1 };

  await page.addInitScript((existing: boolean) => {
    const w = window as unknown as Record<string, unknown>;
    w.__unsubCalls = 0;
    const makeSub = () => ({
      endpoint: "https://push.example/e2e",
      toJSON: () => ({ endpoint: "https://push.example/e2e", keys: { p256dh: "p", auth: "a" } }),
      unsubscribe: async () => {
        (w.__unsubCalls as number)++;
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
      value: { register: async () => reg, ready: Promise.resolve(reg) },
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
    api.calls.push({ method: req.method(), path });
    if (api.failing.has(path)) {
      return route.fulfill({ status: 500, headers: cors, contentType: "application/json", body: JSON.stringify({ detail: "server exploded" }) });
    }
    if (path === "/api/v1/notifications/subscribe") return route.fulfill({ status: 201, headers: cors, contentType: "application/json", body: "{}" });
    if (path === "/api/v1/notifications/unsubscribe") return route.fulfill({ status: 204, headers: cors });
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
