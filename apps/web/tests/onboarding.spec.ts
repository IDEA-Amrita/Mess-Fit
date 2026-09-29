import { test, expect, type Page } from "@playwright/test";
import { gotoReady } from "./support/page";
import { signIn } from "./support/session";

// The four onboarding steps end to end, against a mocked API. What matters
// here is what actually gets saved (a "lose" goal once saved a zero rate,
// which the calorie engine reads as maintenance) and how the route guard
// treats new versus finished users.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};
const MESS_ID = "11111111-1111-4111-8111-111111111111";
const TARGETS = {
  bmi: 21.2, bmi_class: "normal", bmr: 1700, tdee: 2400, daily_kcal: 2100,
  daily_protein_g: 120, daily_carbs_g: 260, daily_fats_g: 58,
  rationale: {
    age: 21, bmi_formula: "x", bmi_classification_basis: "x", bmr_formula: "x", tdee_formula: "x",
    kcal_target_basis: "x", protein_basis: "x", fats_basis: "x", carbs_basis: "x", conditions_applied: [],
  },
};

type Saved = { profile?: Record<string, unknown>; hostel?: Record<string, unknown>; profileAttempts: number };

async function mockApi(page: Page, opts: { failProfileOnce?: boolean } = {}) {
  const saved: Saved = { profileAttempts: 0 };
  let failNext = !!opts.failProfileOnce;
  await page.route("http://localhost:8000/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/mess/messes") return json(200, [{ id: MESS_ID, name: "Main Mess", college: "Test College", city: "Coimbatore" }]);
    if (path === "/api/v1/profile/me" && req.method() === "PUT") {
      saved.profileAttempts++;
      if (failNext) {
        failNext = false;
        return json(422, { detail: [{ loc: ["body", "dob"], msg: "bad", type: "value_error" }] });
      }
      saved.profile = req.postDataJSON();
      return json(200, saved.profile);
    }
    if (path === "/api/v1/profile/hostel-context" && req.method() === "PUT") {
      saved.hostel = req.postDataJSON();
      return json(200, saved.hostel);
    }
    if (path === "/api/v1/profile/targets") return json(200, TARGETS);
    return json(404, { detail: "not mocked" });
  });
  return saved;
}

const next = (page: Page) => page.getByRole("button", { name: /^Next/ });

async function completeProfileStep(page: Page) {
  await gotoReady(page, "/onboarding/profile");
  await page.getByLabel("Date of birth").fill("2004-05-10");
  await next(page).click();
  await expect(page).toHaveURL(/\/onboarding\/goal$/);
}

test.describe("route guard", () => {
  test("a new user is sent to onboarding from anywhere in the app", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, { onboarded: false });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding\/profile$/);
  });

  test("a finished user is sent away from onboarding", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, { onboarded: true });
    await gotoReady(page, "/onboarding/profile");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("steps", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!, { onboarded: false });
  });

  test("profile: needs a valid date of birth before continuing", async ({ page }) => {
    await mockApi(page);
    await gotoReady(page, "/onboarding/profile");
    await expect(next(page)).toBeDisabled();

    await page.getByLabel("Date of birth").fill("2999-01-01");
    await expect(page.getByText("can't be in the future")).toBeVisible();
    await expect(next(page)).toBeDisabled();

    await page.getByLabel("Date of birth").fill("2004-05-10");
    await expect(next(page)).toBeEnabled();
    await next(page).click();
    await expect(page).toHaveURL(/\/onboarding\/goal$/);
  });

  test("the draft survives a reload", async ({ page }) => {
    await mockApi(page);
    await gotoReady(page, "/onboarding/profile");
    await page.getByLabel("Date of birth").fill("2004-05-10");
    await page.reload();
    await expect(page.getByLabel("Date of birth")).toHaveValue("2004-05-10");
  });

  test("goal: choosing lose or gain shows the weekly-rate slider; maintain hides it", async ({ page }) => {
    await mockApi(page);
    await completeProfileStep(page);

    await page.getByRole("radio", { name: /Lose weight/ }).click();
    await expect(page.getByText("Weekly loss")).toBeVisible();
    await page.getByRole("radio", { name: /Gain weight/ }).click();
    await expect(page.getByText("Weekly gain")).toBeVisible();
    await page.getByRole("radio", { name: /Maintain/ }).click();
    await expect(page.getByText("Target weight")).toHaveCount(0);
  });

  test("hostel: refuses to save without a mess", async ({ page }) => {
    await mockApi(page);
    await completeProfileStep(page);
    await next(page).click(); // goal
    await expect(page).toHaveURL(/\/onboarding\/diet$/);
    await next(page).click(); // diet
    await expect(page).toHaveURL(/\/onboarding\/hostel$/);

    await page.getByRole("button", { name: /See my targets/ }).click();
    await expect(page.getByText("Please select your mess")).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding\/hostel$/);
  });
});

test.describe("finishing", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!, { onboarded: false });
  });

  async function walkToHostel(page: Page) {
    await completeProfileStep(page);
    await page.getByRole("radio", { name: /Lose weight/ }).click();
    await next(page).click();
    await expect(page).toHaveURL(/\/onboarding\/diet$/);
    await page.getByRole("button", { name: "Vegetarian", exact: true }).click();
    await page.getByRole("button", { name: /nuts/i }).click();
    await next(page).click();
    await expect(page).toHaveURL(/\/onboarding\/hostel$/);
    await page.getByRole("button", { name: /Main Mess/ }).click();
  }

  test("saves a correctly-signed goal, marks onboarding done, and reaches the dashboard", async ({ page }) => {
    const saved = await mockApi(page);
    await walkToHostel(page);
    await page.getByRole("button", { name: /See my targets/ }).click();

    await expect(page).toHaveURL(/\/onboarding\/targets$/);
    expect(saved.profile).toMatchObject({ goal: "lose", diet_type: "veg", dob: "2004-05-10" });
    expect(saved.profile!.allergies).toContain("nuts");
    // A zero rate would have been read as "maintenance" by the calorie engine.
    expect(saved.profile!.target_rate_kg_per_week as number).toBeLessThan(0);
    expect(saved.profile!.target_weight_kg as number).toBeLessThan(saved.profile!.current_weight_kg as number);
    expect(saved.hostel).toMatchObject({ mess_id: MESS_ID });

    // (The kcal figure is a count-up animation, so assert on the loaded screen instead.)
    const looksGood = page.getByRole("link", { name: /Looks good/ });
    await expect(looksGood).toBeVisible();
    await looksGood.click();
    // Only reachable if the refreshed session now says onboarded.
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("a failed save explains itself and a retry succeeds", async ({ page }) => {
    const saved = await mockApi(page, { failProfileOnce: true });
    await walkToHostel(page);
    await page.getByRole("button", { name: /See my targets/ }).click();

    await expect(page.getByText(/look invalid/i)).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding\/hostel$/);

    await page.getByRole("button", { name: /See my targets/ }).click();
    await expect(page).toHaveURL(/\/onboarding\/targets$/);
    expect(saved.profileAttempts).toBe(2);
  });
});
