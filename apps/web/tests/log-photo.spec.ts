import { test, expect, type Page } from "@playwright/test";
import { gotoReady } from "./support/page";
import { signIn } from "./support/session";

// "Snap Photo" on the Log page: the photo is only *estimated* by the API, and
// the page itself saves the meal with those macros. Also covers the checks
// that stop a bad file before (client) or at (server) the upload.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const TODAY = { date: "2026-09-29", meals: [], weight: null, subjective: null, workout_status: null };
const PLATE = {
  plan: { breakfast: [], lunch: [], snack: [], dinner: [] },
  daily_totals: { kcal: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
  daily_targets: { kcal: 2000, protein_g: 100, carbs_g: 250, fats_g: 60 },
  gap_fills: [], solver_status: "optimal", solve_time_ms: 5,
};
const ESTIMATE = {
  meal_type: "breakfast",
  dishes: [{ name: "Idli", portion: "3 pieces" }],
  total_kcal: 330, total_protein_g: 10, total_carbs_g: 66, total_fats_g: 2, confidence: "high",
};

type Api = { photoCalls: number; photoStatus: number; photoBody: unknown; saved: Record<string, unknown>[] };

async function mockApi(page: Page): Promise<Api> {
  const api: Api = { photoCalls: 0, photoStatus: 201, photoBody: ESTIMATE, saved: [] };
  await page.route("http://localhost:8000/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/api/v1/logs/today") return json(200, TODAY);
    if (path === "/api/v1/optimize/today") return json(200, PLATE);
    if (path === "/api/v1/logs/photo") {
      api.photoCalls++;
      return json(api.photoStatus, api.photoBody);
    }
    if (path === "/api/v1/logs/meals" && req.method() === "POST") {
      const body = req.postDataJSON() as Record<string, unknown>;
      api.saved.push(body);
      return json(201, { id: "m1", notes: null, kcal: null, protein_g: null, carbs_g: null, fats_g: null, ...body });
    }
    return json(404, { detail: "not mocked" });
  });
  return api;
}

const breakfastPhotoInput = (page: Page) => page.locator('input[type="file"]').first();

test.beforeEach(async ({ context, baseURL }) => {
  await signIn(context, baseURL!);
});

test("a photo estimate is saved as the meal, with its macros", async ({ page }) => {
  const api = await mockApi(page);
  await gotoReady(page, "/dashboard/log");
  await expect(page.getByRole("button", { name: "Snap Photo" }).first()).toBeVisible();

  await breakfastPhotoInput(page).setInputFiles({ name: "plate.jpg", mimeType: "image/jpeg", buffer: JPEG });

  await expect(page.getByText("Photo logged successfully")).toBeVisible();
  await expect.poll(() => api.saved.length).toBe(1);
  expect(api.saved[0]).toMatchObject({ meal_type: "breakfast", kcal: 330, protein_g: 10, carbs_g: 66, fats_g: 2 });
  expect(String(api.saved[0].notes)).toContain("Idli");
});

test("the server's reason for refusing a photo is shown, and nothing is saved", async ({ page }) => {
  const api = await mockApi(page);
  api.photoStatus = 415;
  api.photoBody = { detail: "That file isn't a valid image." };
  await gotoReady(page, "/dashboard/log");

  await breakfastPhotoInput(page).setInputFiles({ name: "plate.jpg", mimeType: "image/jpeg", buffer: JPEG });

  await expect(page.getByText("That file isn't a valid image.", { exact: true })).toBeVisible();
  expect(api.photoCalls).toBe(1);
  expect(api.saved).toHaveLength(0);
});

test("an oversized photo is stopped before it is uploaded", async ({ page }) => {
  const api = await mockApi(page);
  await gotoReady(page, "/dashboard/log");

  const big = Buffer.concat([JPEG, Buffer.alloc(10 * 1024 * 1024)]);
  await breakfastPhotoInput(page).setInputFiles({ name: "huge.jpg", mimeType: "image/jpeg", buffer: big });

  await expect(page.getByText("larger than 10 MB")).toBeVisible();
  expect(api.photoCalls).toBe(0);
});

test("the picker only offers image types the server accepts", async ({ page }) => {
  await mockApi(page);
  await gotoReady(page, "/dashboard/log");
  await expect(breakfastPhotoInput(page)).toHaveAttribute("accept", "image/jpeg,image/png,image/webp,image/heic,image/heif");
});
