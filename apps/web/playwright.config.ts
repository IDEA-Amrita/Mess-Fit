import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // `next dev` compiles each route on first visit; on a cold CI runner a
  // multi-page journey can spend well over 30s just compiling.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Only set when PLAYWRIGHT_CHROMIUM_PATH is exported — lets a
        // machine with a non-standard browser cache (missing the exact
        // headless-shell build `playwright install` would normally fetch)
        // point at an already-installed Chromium without affecting normal
        // CI/dev machines, which always leave this unset.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  // Two processes: a Supabase-auth mock (tests/mocks/auth-server.mjs, so e2e
  // never depends on the real — sandbox/CI-unreachable — Supabase project)
  // and `next dev` pointed at it via env overrides. Next.js only fills in
  // .env.local values that aren't already set in process.env, so these win.
  webServer: [
    {
      command: 'node tests/mocks/auth-server.mjs',
      url: 'http://localhost:54321/auth/v1/user',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node tests/mocks/api-server.mjs',
      url: 'http://localhost:8000/api/v1/me',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-mock-anon-key',
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8000',
        // Any well-formed VAPID public key (65 bytes, base64url); the push
        // e2e stubs the browser's PushManager, so it never leaves the page.
        NEXT_PUBLIC_VAPID_PUBLIC_KEY:
          'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
      },
    },
  ],
});
