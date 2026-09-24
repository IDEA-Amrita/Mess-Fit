import { test, expect } from "@playwright/test";
import { signIn } from "./support/session";

// Phone-width regressions: nothing scrolls sideways, and the site footer's
// links stay reachable above the fixed bottom tab bar.
test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

const PAGES = ["/dashboard", "/dashboard/plate", "/dashboard/log", "/dashboard/progress", "/dashboard/workout", "/dashboard/chat", "/dashboard/settings", "/menu", "/learn", "/quick"];

test.beforeEach(async ({ context, baseURL, page }) => {
  await signIn(context, baseURL!);
  await page.route("http://localhost:8000/**", (route) =>
    route.request().method() === "OPTIONS"
      ? route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } })
      : route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: '{"detail":"not mocked"}' }),
  );
});

for (const path of PAGES) {
  test(`no horizontal scroll at 360px: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("footer links are not covered by the bottom tab bar", async ({ page }) => {
  await page.goto("/dashboard/settings");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  for (const name of ["Learn", "Privacy", "Terms"]) {
    const link = page.locator("footer").getByRole("link", { name, exact: true });
    const hit = await link.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { covered: !(top === el || el.contains(top)), height: b.height };
    });
    expect(hit.covered, `${name} is covered`).toBe(false);
    expect(hit.height, `${name} tap height`).toBeGreaterThanOrEqual(40);
  }
});
