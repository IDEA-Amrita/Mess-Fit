import type { Page } from "@playwright/test";

/**
 * Navigate and wait until React has hydrated the page.
 *
 * Server-rendered inputs are visible (and fillable) before hydration, but
 * hydration resets a controlled input to its state, so a value typed too early
 * silently disappears. Providers sets `html[data-hydrated]` once the tree is
 * interactive; use this instead of page.goto wherever a test types right away.
 */
export async function gotoReady(page: Page, url: string) {
  await page.goto(url);
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}
