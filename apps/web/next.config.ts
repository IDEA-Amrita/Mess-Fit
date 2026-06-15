import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// Sentry build-time wrapper (Phase 9, task 9.3). Source-map upload only runs
// when SENTRY_AUTH_TOKEN/org/project are set; otherwise this is a quiet no-op,
// so `next build` works without any Sentry credentials.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  disableLogger: true,
  widenClientFileUpload: true,
});
