"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { ErrorState } from "@/components/ui/error-state";

// Route-level error boundary: a render error in any page lands here instead
// of Next's bare default screen, keeping the app chrome (providers, footer).
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <ErrorState
        title="Something went wrong"
        description="An unexpected error stopped this page from loading. It's been reported, and trying again often fixes it."
        action={
          <div className="flex items-center gap-4">
            <button
              onClick={reset}
              className="rounded-full bg-accent px-6 py-3 text-[12px] font-black uppercase tracking-widest text-black transition-[filter] hover:brightness-110"
            >
              Try again
            </button>
            <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Go to dashboard
            </Link>
          </div>
        }
      />
    </main>
  );
}
