import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: false,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /\/api\/v1\/.*/,
        handler: 'NetworkOnly',
        method: 'POST',
        options: {
          backgroundSync: {
            name: 'api-sync-queue',
            options: {
              maxRetentionTime: 24 * 60 // Retry for up to 24 hours
            }
          }
        }
      }
    ]
  }
});

const nextConfig: NextConfig = {
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
};

// Sentry build-time wrapper (Phase 9, task 9.3). Source-map upload only runs
// when SENTRY_AUTH_TOKEN/org/project are set; otherwise this is a quiet no-op,
// so `next build` works without any Sentry credentials.
export default withSentryConfig(withPWA(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  disableLogger: true,
  widenClientFileUpload: true,
});
