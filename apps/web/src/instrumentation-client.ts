// Sentry browser init (Phase 9, task 9.3). No-op unless NEXT_PUBLIC_SENTRY_DSN
// is set, so `next build` and local dev never ship events.
//
// Privacy: MessFit handles health data, so session replay is OFF
// (replaysSessionSampleRate = 0). Error-only replays are fully masked.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENV ?? "development",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0, // no session replay (privacy)
    replaysOnErrorSampleRate: 0.1, // only on errors
    sendDefaultPii: false,
    integrations: [
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
  });
}

// Instruments App Router client-side navigations for tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
