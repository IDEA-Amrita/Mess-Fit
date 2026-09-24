import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./support/session";

// Sign-in-flow screens. The browser's Supabase calls (all to :54321) are
// intercepted per test so each server behaviour can be forced; anything not
// intercepted falls through to tests/mocks/auth-server.mjs.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

type Reply = { status: number; body: unknown };

/** Intercept one Supabase endpoint; returns the request bodies it received. */
async function stub(page: Page, method: string, path: string, reply: Reply) {
  const bodies: unknown[] = [];
  await page.route(`http://localhost:54321${path}*`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (req.method() !== method) return route.fallback();
    try {
      bodies.push(req.postDataJSON());
    } catch {
      bodies.push(null);
    }
    return route.fulfill({ status: reply.status, headers: CORS, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return bodies;
}

const authError = (status: number, error_code: string, msg: string): Reply => ({ status, body: { code: status, error_code, msg } });

test.describe("login", () => {
  test("a wrong password says so in plain words and lets you retry", async ({ page }) => {
    await stub(page, "POST", "/auth/v1/token", authError(400, "invalid_credentials", "Invalid login credentials"));
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill("a@b.co");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  });

  test("the password can be shown and hidden", async ({ page }) => {
    await page.goto("/auth/login");
    const input = page.getByLabel("Password", { exact: true });
    await expect(input).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(input).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(input).toHaveAttribute("type", "password");
  });

  test("inputs carry autocomplete hints so password managers work", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password");
  });

  test("a failed OAuth return shows the provider's reason on the login page", async ({ page }) => {
    await page.goto("/auth/callback?error=access_denied&error_description=Access%20was%20denied");
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("alert").filter({ hasText: "Access was denied" })).toBeVisible();
  });
});

test.describe("forgot password", () => {
  test("is reachable from login and confirms without revealing whether the account exists", async ({ page }) => {
    const bodies = await stub(page, "POST", "/auth/v1/recover", { status: 200, body: {} });
    await page.goto("/auth/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/auth\/forgot-password$/);

    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByRole("status").filter({ hasText: "If an account exists" })).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect((bodies[0] as { email: string }).email).toBe("someone@example.com");
  });

  test("a rate limit is explained", async ({ page }) => {
    await stub(page, "POST", "/auth/v1/recover", authError(429, "over_email_send_rate_limit", "email rate limit exceeded"));
    await page.goto("/auth/forgot-password");
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Too many attempts" })).toBeVisible();
  });
});

test.describe("reset password", () => {
  test("a signed-in recovery session can set a new password and lands on the dashboard", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    const bodies = await stub(page, "PUT", "/auth/v1/user", {
      status: 200,
      body: { id: "e2e-user-1", aud: "authenticated", email: "e2e@messfit.local", user_metadata: { onboarded: true } },
    });
    await page.goto("/auth/reset-password");

    // Not bounced to /dashboard the way other /auth pages are for signed-in users.
    await expect(page.getByRole("button", { name: "Update password" })).toBeVisible();

    await page.getByLabel("New password").fill("brand-new-pass-1");
    await page.getByLabel("Confirm password").fill("something-else-99");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();
    expect(bodies).toHaveLength(0);

    await page.getByLabel("Confirm password").fill("brand-new-pass-1");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect((bodies[0] as { password: string }).password).toBe("brand-new-pass-1");
  });

  test("without a valid link, the user is told it expired and can ask for another", async ({ page }) => {
    await page.goto("/auth/reset-password");
    await expect(page.getByText("Verifying your link…")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "invalid or has expired" })).toBeVisible({ timeout: 12_000 });
    await page.getByRole("link", { name: "Request a new link" }).click();
    await expect(page).toHaveURL(/\/auth\/forgot-password$/);
  });
});

test.describe("signup", () => {
  const fill = async (page: Page) => {
    await page.getByLabel("Name").fill("New Person");
    await page.getByLabel("Email").fill("new@example.com");
    await page.getByLabel("Password", { exact: true }).fill("longenough1");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
  };

  test("with email confirmation on, the user is told to check their inbox (not bounced to login)", async ({ page }) => {
    await stub(page, "POST", "/auth/v1/signup", {
      status: 200,
      body: { id: "u-new", aud: "authenticated", email: "new@example.com", identities: [{ identity_id: "i1" }], user_metadata: {} },
    });
    await page.goto("/auth/signup");
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
    await fill(page);

    await expect(page.getByRole("status").filter({ hasText: "confirmation link" })).toContainText("new@example.com");
    await expect(page).toHaveURL(/\/auth\/signup$/);
  });

  test("an already-registered address is reported, not silently 'confirmed'", async ({ page }) => {
    await stub(page, "POST", "/auth/v1/signup", {
      status: 200,
      body: { id: "u-old", aud: "authenticated", email: "new@example.com", identities: [], user_metadata: {} },
    });
    await page.goto("/auth/signup");
    await fill(page);
    await expect(page.getByRole("alert").filter({ hasText: "already exists" })).toBeVisible();
  });
});
