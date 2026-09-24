import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./support/session";

// Admin screens. Access is decided server-side in src/proxy.ts, which asks
// tests/mocks/api-server.mjs for the caller's role (sub starting with "admin"
// => admin). Data calls from the browser are intercepted per test.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};
const MESS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MESS_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MESSES = [
  { id: MESS_A, name: "Main Mess", college: "Test College", city: "Coimbatore" },
  { id: MESS_B, name: "North Mess", college: "Test College", city: "Coimbatore" },
];
const dish = (name: string, category = "main") => ({
  id: name, name, category, default_serving_unit: "bowl", default_serving_grams: 150,
  kcal: 200, protein_g: 8, carbs_g: 30, fats_g: 5, portion_icon: "", tags: [],
});

type Reply = { status: number; body?: unknown };
async function mockApi(page: Page, respond: (method: string, path: string, req: { body: () => unknown }) => Reply | undefined) {
  const hits: string[] = [];
  await page.route("http://localhost:8000/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    hits.push(`${req.method()} ${path}`);
    const r = respond(req.method(), path, { body: () => req.postDataJSON() }) ?? { status: 404, body: { detail: "not mocked" } };
    return route.fulfill({
      status: r.status,
      headers: CORS,
      contentType: "application/json",
      body: r.body === undefined ? "" : JSON.stringify(r.body),
    });
  });
  return hits;
}

test.describe("access", () => {
  test("a non-admin is sent back to the dashboard", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto("/admin/ocr");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("an admin gets in and sees the admin navigation", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, { admin: true });
    await mockApi(page, (m, p) => (p === "/mess/messes" ? { status: 200, body: [] } : p === "/mess/admin/ocr/jobs" ? { status: 200, body: [] } : undefined));
    await page.goto("/admin/ocr");
    await expect(page.getByRole("heading", { name: "Menu OCR" })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Menu OCR" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Dishes" }).click();
    await expect(page).toHaveURL(/\/admin\/dishes$/);
  });
});

test.describe("lists", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, baseURL!, { admin: true }));

  test("a failed load is an error with retry, not 'No dishes found'", async ({ page }) => {
    let failing = true;
    await mockApi(page, (m, p) =>
      p === "/mess/dishes" ? (failing ? { status: 500, body: { detail: "boom" } } : { status: 200, body: [dish("Idli")] }) : undefined,
    );
    await page.goto("/admin/dishes");
    const alert = page.getByRole("alert").filter({ hasText: "Couldn't load dishes" });
    await expect(alert).toBeVisible();
    await expect(page.getByText("No dishes found.")).toHaveCount(0);

    failing = false;
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("cell", { name: "Idli" })).toBeVisible();
  });

  test("dishes can be searched", async ({ page }) => {
    await mockApi(page, (m, p) =>
      p === "/mess/dishes" ? { status: 200, body: [dish("Idli", "breakfast"), dish("Dal", "main"), dish("Paneer", "main")] } : undefined,
    );
    await page.goto("/admin/dishes");
    await expect(page.getByRole("cell", { name: "Idli" })).toBeVisible();

    await page.getByRole("textbox", { name: "Search dishes" }).fill("main");
    await expect(page.getByRole("cell", { name: "Dal" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Idli" })).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("2 of 3");

    await page.getByRole("textbox", { name: "Search dishes" }).fill("zzz");
    await expect(page.getByText("No dishes match your search.")).toBeVisible();
  });

  test("each mess links to the upload page with that mess preselected", async ({ page }) => {
    await mockApi(page, (m, p) => {
      if (p === "/mess/messes") return { status: 200, body: MESSES };
      if (p === "/mess/admin/ocr/jobs") return { status: 200, body: [] };
    });
    await page.goto("/admin/messes");
    await page.getByRole("row", { name: /North Mess/ }).getByRole("link", { name: "Upload menu photo" }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/ocr\\?mess=${MESS_B}`));
    await expect(page.getByLabel("Mess")).toHaveValue(MESS_B);
  });

  test("the old per-mess menu URL redirects to the upload page", async ({ page }) => {
    await mockApi(page, (m, p) => {
      if (p === "/mess/messes") return { status: 200, body: MESSES };
      if (p === "/mess/admin/ocr/jobs") return { status: 200, body: [] };
    });
    await page.goto(`/admin/messes/${MESS_A}/menu`);
    await expect(page).toHaveURL(new RegExp(`/admin/ocr\\?mess=${MESS_A}`));
  });
});

test.describe("OCR jobs", () => {
  test.beforeEach(async ({ context, baseURL }) => signIn(context, baseURL!, { admin: true }));

  test("polls only while a job is in flight", async ({ page }) => {
    let status = "processing";
    const hits = await mockApi(page, (m, p) => {
      if (p === "/mess/messes") return { status: 200, body: MESSES };
      if (p === "/mess/admin/ocr/jobs") return { status: 200, body: [{ id: "job-0001-abcd", mess_id: MESS_A, status, error_message: null }] };
    });
    await page.goto("/admin/ocr");
    await expect(page.getByText("processing")).toBeVisible();

    const count = () => hits.filter((h) => h === "GET /mess/admin/ocr/jobs").length;
    await expect.poll(count, { timeout: 12_000 }).toBeGreaterThanOrEqual(2); // it polled while processing

    status = "ready_for_review";
    await expect(page.getByRole("link", { name: "Review" })).toBeVisible({ timeout: 12_000 });
    const settled = count();
    await page.waitForTimeout(6000);
    expect(count()).toBe(settled); // and stopped once nothing was in flight
  });

  test("upload requires a photo, and an API failure is shown", async ({ page }) => {
    await mockApi(page, (m, p) => {
      if (p === "/mess/messes") return { status: 200, body: MESSES };
      if (p === "/mess/admin/ocr/jobs" && m === "GET") return { status: 200, body: [] };
      if (p === "/mess/admin/ocr/jobs" && m === "POST") return { status: 413, body: { detail: "Image too large." } };
    });
    await page.goto("/admin/ocr");
    await page.getByRole("button", { name: "Upload & parse" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Choose a menu photo first." })).toBeVisible();

    await page.getByLabel("Menu photo").setInputFiles({ name: "menu.png", mimeType: "image/png", buffer: Buffer.from("x") });
    await page.getByRole("button", { name: "Upload & parse" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Image too large." })).toBeVisible();
  });

  test("an approval is confirmed on the list page", async ({ page }) => {
    await mockApi(page, (m, p) => {
      if (p === "/mess/messes") return { status: 200, body: MESSES };
      if (p === "/mess/admin/ocr/jobs") return { status: 200, body: [] };
    });
    await page.goto("/admin/ocr?approved=14");
    await expect(page.getByRole("status").filter({ hasText: "Menu approved — 14 menu rows added." })).toBeVisible();
  });
});

test.describe("OCR review", () => {
  // The Monday-default test is about IST specifically; pin it so it means the same everywhere.
  test.use({ timezoneId: "Asia/Kolkata" });
  test.beforeEach(async ({ context, baseURL }) => signIn(context, baseURL!, { admin: true }));

  const JOB = {
    id: "job-1", mess_id: MESS_A, status: "ready_for_review", error_message: null, image_url: null,
    parsed_result: {
      weekly: [
        {
          day: "Monday",
          meals: [
            {
              type: "breakfast",
              dishes: [{ name: "Idly", confidence_low: false, matched_dish_id: "d1", matched_name: "Idli", match_score: 0.92, needs_review: false }],
            },
          ],
        },
      ],
    },
  };

  test("a failed load shows an error with retry instead of hanging on 'Loading…'", async ({ page }) => {
    let failing = true;
    await mockApi(page, (m, p) => (p === "/mess/admin/ocr/jobs/job-1" ? (failing ? { status: 500, body: { detail: "x" } } : { status: 200, body: JOB }) : undefined));
    await page.goto("/admin/ocr/job-1");
    const alert = page.getByRole("alert").filter({ hasText: "Couldn't load this job" });
    await expect(alert).toBeVisible();

    failing = false;
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "Review parsed menu" })).toBeVisible();
  });

  test("effective-from defaults to this week's Monday in local time", async ({ page }) => {
    // 00:30 IST on a Monday is still Sunday in UTC — the old toISOString() gave Sunday.
    await page.clock.setFixedTime(new Date("2026-09-21T00:30:00+05:30"));
    await mockApi(page, (m, p) => (p === "/mess/admin/ocr/jobs/job-1" ? { status: 200, body: JOB } : undefined));
    await page.goto("/admin/ocr/job-1");
    await expect(page.getByLabel("Effective from")).toHaveValue("2026-09-21");
  });

  test("approve sends the reviewed menu; reject needs a confirmation", async ({ page }) => {
    let approved: unknown;
    let rejected = false;
    await mockApi(page, (m, p, req) => {
      if (p === "/mess/admin/ocr/jobs/job-1" && m === "GET") return { status: 200, body: JOB };
      if (p === "/mess/admin/ocr/jobs/job-1/approve") {
        approved = req.body();
        return { status: 200, body: { menu_rows_added: 7 } };
      }
      if (p === "/mess/admin/ocr/jobs/job-1/reject") {
        rejected = true;
        return { status: 200, body: { ...JOB, status: "rejected" } };
      }
      if (p === "/mess/admin/ocr/jobs") return { status: 200, body: [] };
      if (p === "/mess/messes") return { status: 200, body: MESSES };
    });
    await page.goto("/admin/ocr/job-1");
    await page.getByLabel("Monday breakfast dish name").fill("Idli (edited)");

    // One click must not reject.
    await page.getByRole("button", { name: "Reject", exact: true }).click();
    expect(rejected).toBe(false);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Reject", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Approve into menu" }).click();
    await expect(page).toHaveURL(/\/admin\/ocr\?approved=7$/);
    expect(approved).toMatchObject({
      weekly: [{ day_of_week: 0, meals: [{ type: "breakfast", dishes: [{ name: "Idli (edited)", dish_id: "d1" }] }] }],
    });
  });
});
