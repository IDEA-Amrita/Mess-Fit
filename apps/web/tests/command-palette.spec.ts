import { test, expect } from "@playwright/test";
import { signIn } from "./support/session";

// Command palette (Ctrl/Cmd+K) lives in every authenticated dashboard route
// (src/components/DashboardShell.tsx + CommandPalette.tsx). These tests run
// against the mock Supabase session from tests/support/session.ts — see
// playwright.config.ts for how `next dev` is pointed at the mock.
test.beforeEach(async ({ context, baseURL, page }) => {
  await signIn(context, baseURL!);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("opens via the visible search button and closes on Escape, returning focus", async ({ page }) => {
  const trigger = page.getByRole("button", { name: /search/i }).first();
  await trigger.focus();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("combobox")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("opens via Ctrl+K from anywhere on the page", async ({ page }) => {
  await page.locator("body").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
});

test("filters commands as you type and shows an empty state for no matches", async ({ page }) => {
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox");

  await input.fill("progress");
  await expect(page.getByRole("option", { name: /Progress/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Workout/ })).toHaveCount(0);

  await input.fill("zzzznomatch");
  await expect(page.getByText(/No matches for/)).toBeVisible();
});

test("Enter navigates to the highlighted command", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("settings");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard\/settings$/);
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeHidden();
});

test("arrow keys move the highlighted option", async ({ page }) => {
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox");
  await input.fill("s"); // matches Settings, and anything else with "s"

  const options = page.getByRole("option");
  const firstId = await options.first().getAttribute("id");
  await expect(input).toHaveAttribute("aria-activedescendant", firstId!);

  await page.keyboard.press("ArrowDown");
  const secondId = await options.nth(1).getAttribute("id");
  await expect(input).toHaveAttribute("aria-activedescendant", secondId!);
});

test("Tab does not move focus out of the dialog (focus trap)", async ({ page }) => {
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox");
  await expect(input).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(input).toBeFocused();
});

test("clicking the backdrop closes the palette", async ({ page }) => {
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();

  // The backdrop is the dialog's absolutely-positioned sibling covering the
  // rest of the viewport — click well outside the dialog's own box.
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
});
