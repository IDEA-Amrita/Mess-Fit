import { test, expect, type Page, type Route } from "@playwright/test";
import { signIn } from "./support/session";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

const dish = (name: string) => ({
  dish_id: name, name, portions: 2, serving_unit: "pieces", portion_icon: "", grams: 100,
  kcal: 200, protein_g: 6, carbs_g: 40, fats_g: 1, reason: "",
});
const plan = (over: Record<string, unknown[]> = {}) => ({
  plan: { breakfast: [dish("Idli")], lunch: [dish("Dal")], snack: [], dinner: [], ...over },
  daily_totals: { kcal: 2000, protein_g: 100, carbs_g: 250, fats_g: 60 },
  daily_targets: { kcal: 2000, protein_g: 100, carbs_g: 250, fats_g: 60 },
  gap_fills: [], solver_status: "optimal", solve_time_ms: 5,
});

type Reply = { status: number; body: unknown };
async function mockApi(page: Page, respond: (path: string) => Reply) {
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
const notMocked: Reply = { status: 404, body: { detail: "not mocked" } };

test.describe("authenticated", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, baseURL!));

  test("plate: shows the plan; a failure offers retry that recovers", async ({ page }) => {
    let failing = true;
    await mockApi(page, (p) =>
      p === "/api/v1/optimize/today"
        ? failing ? { status: 500, body: { detail: "boom" } } : { status: 200, body: plan() }
        : notMocked,
    );
    await page.goto("/dashboard/plate");

    const alert = page.getByRole("alert").filter({ hasText: "Couldn't build your plate" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Something went wrong on our side");

    failing = false;
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Idli")).toBeVisible();
    await expect(alert).toHaveCount(0);
  });

  test("plate: a 409 sends the user to setup instead of offering retry", async ({ page }) => {
    await mockApi(page, (p) =>
      p === "/api/v1/optimize/today" ? { status: 409, body: { detail: "Complete onboarding first." } } : notMocked,
    );
    await page.goto("/dashboard/plate");
    await expect(page.getByRole("heading", { name: "Finish setup first" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Set up profile" })).toBeVisible();
  });

  test("plate: re-roll requests a new plan", async ({ page }) => {
    const hits = await mockApi(page, (p) => (p === "/api/v1/optimize/today" ? { status: 200, body: plan() } : notMocked));
    await page.goto("/dashboard/plate");
    await expect(page.getByText("Idli")).toBeVisible();

    const before = hits["/api/v1/optimize/today"];
    await page.getByRole("button", { name: "Re-roll" }).click();
    await expect.poll(() => hits["/api/v1/optimize/today"]).toBeGreaterThan(before);
    await expect(page.getByText("Idli")).toBeVisible();
  });

  test("plate: a failed photo scan keeps the plan on screen and toasts the reason", async ({ page }) => {
    await mockApi(page, (p) => {
      if (p === "/api/v1/optimize/today") return { status: 200, body: plan() };
      if (p === "/api/v1/optimize/photo") return { status: 422, body: { detail: "No menu text found in that photo." } };
      return notMocked;
    });
    await page.goto("/dashboard/plate");
    await expect(page.getByText("Idli")).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({ name: "menu.png", mimeType: "image/png", buffer: Buffer.from("x") });
    await expect(page.getByText("No menu text found in that photo.")).toBeVisible();
    await expect(page.getByText("Idli")).toBeVisible();
  });

  test("quick: a failed request is an error with retry, not 'no plan'", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-01-05T09:00:00"));
    await mockApi(page, (p) => (p === "/api/v1/optimize/today" ? { status: 500, body: { detail: "x" } } : notMocked));
    await page.goto("/quick");
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't build your plate" })).toBeVisible();
    await expect(page.getByText("No plan available")).toHaveCount(0);
  });

  test("quick: an empty slot is an empty state, and a filled one lists dishes", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-01-05T09:00:00")); // breakfast
    await mockApi(page, (p) =>
      p === "/api/v1/optimize/today" ? { status: 200, body: plan({ breakfast: [] }) } : notMocked,
    );
    await page.goto("/quick");
    await expect(page.getByText("No plan available")).toBeVisible();

    await page.unroute("http://localhost:8000/**");
    await mockApi(page, (p) => (p === "/api/v1/optimize/today" ? { status: 200, body: plan() } : notMocked));
    await page.reload();
    await expect(page.getByText("Idli")).toBeVisible();
  });
});

test.describe("learn (public)", () => {
  test("search and topic filters narrow the list, and clearing restores it", async ({ page }) => {
    await page.goto("/learn");
    const cards = page.locator('a[href^="/learn/"]:has(h2)');
    const total = await cards.count();
    expect(total).toBeGreaterThan(3);

    const search = page.getByRole("textbox", { name: "Search articles" });
    await search.fill("zzzz-no-such-article");
    await expect(page.getByText("No articles match")).toBeVisible();
    await expect(cards).toHaveCount(0);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(cards).toHaveCount(total);

    const firstTag = page.getByRole("group", { name: "Filter by topic" }).getByRole("button").first();
    await firstTag.click();
    await expect(firstTag).toHaveAttribute("aria-pressed", "true");
    expect(await cards.count()).toBeLessThanOrEqual(total);
    await firstTag.click();
    await expect(cards).toHaveCount(total);
  });
});
