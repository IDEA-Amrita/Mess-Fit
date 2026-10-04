import { test, expect, type Page, type Route } from "@playwright/test";
import { gotoReady } from "./support/page";
import { signIn } from "./support/session";

// Mess menu: default mess, day and mess switching, and hiding dishes from the
// optimizer (optimistic, persisted, rolled back on failure).

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

const MESSES = [
  { id: "m-a", name: "Ashwini Mess", college: "Amrita", city: "Coimbatore" },
  { id: "m-b", name: "Bhaskara Mess", college: "Amrita", city: "Coimbatore" },
];

const dish = (id: string, name: string, category = "curry") => ({
  id,
  name,
  category,
  default_serving_unit: "katori",
  default_serving_grams: 150,
  kcal: 150,
  protein_g: 6,
  carbs_g: 20,
  fats_g: 4,
  portion_icon: "katori",
  tags: [],
});

const entry = (messId: string, meal: string, d: ReturnType<typeof dish>) => ({
  id: `${messId}-${meal}-${d.id}`,
  mess_id: messId,
  effective_from: "2026-01-01",
  day_of_week: 0,
  meal_type: meal,
  dish_id: d.id,
  availability: "usually",
  dish: d,
});

// Which dishes each mess serves on the requested day ("today" or "tomorrow").
const SAMBAR = dish("d-sambar", "Sambar");
const MENUS: Record<string, Record<"today" | "tomorrow", { breakfast: unknown[]; lunch: unknown[] }>> = {
  "m-b": {
    today: { breakfast: [entry("m-b", "breakfast", dish("d-idli", "Idli", "other"))], lunch: [entry("m-b", "lunch", SAMBAR)] },
    tomorrow: { breakfast: [entry("m-b", "breakfast", dish("d-pongal", "Pongal", "rice"))], lunch: [] },
  },
  "m-a": {
    today: { breakfast: [entry("m-a", "breakfast", dish("d-poha", "Poha", "rice"))], lunch: [] },
    tomorrow: { breakfast: [], lunch: [] },
  },
};

const isoLocal = (d: Date) => d.toLocaleDateString("en-CA");
const TODAY = isoLocal(new Date());

interface Calls {
  excluded: unknown[];
  unexcluded: string[];
}

async function mockApi(page: Page, opts: { failExclude?: boolean } = {}): Promise<Calls> {
  const calls: Calls = { excluded: [], unexcluded: [] };
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("http://localhost:8000/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const p = url.pathname;

    if (p === "/mess/messes") return json(route, MESSES);
    if (p === "/api/v1/profile/hostel-context") return json(route, { mess_id: "m-b" });
    const menu = p.match(/^\/mess\/messes\/([^/]+)\/menu$/);
    if (menu) {
      const day = url.searchParams.get("date") === TODAY ? "today" : "tomorrow";
      return json(route, { date: url.searchParams.get("date"), day_of_week: 0, snack: [], dinner: [], ...MENUS[menu[1]][day] });
    }
    if (p === "/mess/menu/exclusions" && req.method() === "GET") return json(route, []);
    if (p === "/mess/menu/exclusions" && req.method() === "POST") {
      if (opts.failExclude) return json(route, { detail: "Database unavailable" }, 503);
      calls.excluded.push(req.postDataJSON());
      return json(route, req.postDataJSON(), 201);
    }
    if (p.startsWith("/mess/menu/exclusions/") && req.method() === "DELETE") {
      calls.unexcluded.push(`${p}?${url.searchParams}`);
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (p === "/mess/dishes/feedback") return json(route, { dish_id: "x", confirms: 0, denies: 0 });
    return json(route, { detail: "not mocked" }, 404);
  });
  return calls;
}

test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

test("opens on the student's own mess, today first, and switches day and mess", async ({ page }) => {
  await mockApi(page);
  await gotoReady(page, "/menu");

  await expect(page.getByLabel("Select mess")).toHaveValue("m-b");
  await expect(page.getByText("Idli")).toBeVisible();
  await expect(page.getByText("Sambar")).toBeVisible();

  await page.getByRole("tab", { name: "tomorrow" }).click();
  await expect(page.getByText("Pongal")).toBeVisible();
  await expect(page.getByText("Idli")).toBeHidden();

  await page.getByRole("tab", { name: "today" }).click();
  await page.getByLabel("Select mess").selectOption("m-a");
  await expect(page.getByText("Poha")).toBeVisible();
  await expect(page.getByText("Idli")).toBeHidden();
});

test("hiding a dish keeps it off the plate, and it can be added back", async ({ page }) => {
  const calls = await mockApi(page);
  await gotoReady(page, "/menu");

  await page.getByRole("button", { name: "Hide from plate: Sambar" }).click();

  // Optimistic: the card flips before the server answers, then the hide is saved.
  await expect(page.getByRole("button", { name: "Add back to plate: Sambar" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("1 dish hidden from your plate for today.")).toBeVisible();
  await expect.poll(() => calls.excluded).toEqual([{ date: TODAY, meal_type: "lunch", dish_id: "d-sambar" }]);
  // Only that dish: Idli is untouched.
  await expect(page.getByRole("button", { name: "Hide from plate: Idli" })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Add back to plate: Sambar" }).click();
  await expect(page.getByRole("button", { name: "Hide from plate: Sambar" })).toBeVisible();
  await expect(page.getByText(/hidden from your plate/)).toBeHidden();
  await expect.poll(() => calls.unexcluded).toEqual([
    `/mess/menu/exclusions/d-sambar?date=${TODAY}&meal_type=lunch`,
  ]);
});

test("every dish's controls name the dish for screen readers", async ({ page }) => {
  await mockApi(page);
  await gotoReady(page, "/menu");
  for (const name of ["Idli", "Sambar"]) {
    await expect(page.getByRole("button", { name: `Hide from plate: ${name}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Yes, ${name} is being served` })).toBeVisible();
    await expect(page.getByRole("button", { name: `No, ${name} isn't being served` })).toBeVisible();
  }
});

test("a failed hide is rolled back and explained", async ({ page }) => {
  await mockApi(page, { failExclude: true });
  await gotoReady(page, "/menu");

  await page.getByRole("button", { name: "Hide from plate: Sambar" }).click();
  await expect(page.getByText("Database unavailable")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide from plate: Sambar" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText(/hidden from your plate/)).toBeHidden();
});
