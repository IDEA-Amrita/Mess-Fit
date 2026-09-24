import { test, expect } from "@playwright/test";
import { signIn } from "./support/session";

// A transform on the route-transition wrapper (app/template.tsx) makes it the
// containing block for `position: fixed` descendants, so the sidebar shifted
// during every navigation and overlays opened mid-transition were misplaced.
test("fixed chrome and overlays stay viewport-fixed during a route change", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL!);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Sample the sidebar's position every frame across the transition.
  const tops = page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const seen: number[] = [];
        const start = performance.now();
        const tick = () => {
          const aside = document.querySelector("aside");
          if (aside) seen.push(Math.round(aside.getBoundingClientRect().top));
          if (performance.now() - start < 700) requestAnimationFrame(tick);
          else resolve(seen);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.getByRole("link", { name: "Settings" }).first().click();
  const seen = await tops;

  expect(seen.length).toBeGreaterThan(5);
  expect(new Set(seen)).toEqual(new Set([0]));

  // And an overlay opened right after navigating covers the whole viewport.
  await page.keyboard.press("Control+k");
  const covers = await page.evaluate(() => {
    const el = document.elementFromPoint(5, 5);
    return !!el && el.closest('[role="dialog"]') === null && el.className.toString().includes("bg-black");
  });
  expect(covers).toBe(true);
});
