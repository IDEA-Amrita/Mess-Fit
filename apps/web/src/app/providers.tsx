"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PwaStatus } from "@/components/PwaStatus";
import { Toaster } from "@/components/Toaster";
import { MotionProvider } from "@/components/motion/motion-provider";
import { initAnalytics } from "@/lib/analytics";
import { clearOnboardingData } from "@/lib/onboarding-store";
import { supabase } from "@/lib/supabase";
import { clearSession } from "@/lib/workout-session";

/**
 * App-wide client providers. The QueryClient is created in state so it's stable
 * across re-renders but never shared between users/requests on the server.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 300_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  useEffect(() => initAnalytics(), []);

  // Marks the moment the page became interactive (this effect runs after every
  // child has hydrated). Anything typed into server-rendered inputs before then
  // is reset by hydration, so the e2e suite waits for this (tests/support/page.ts).
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);

  // Nothing tied to one account may outlive it. Sign-out is a client-side
  // navigation, so without this the in-memory query cache (5 min stale time),
  // the onboarding draft and an in-progress workout would all still be there for
  // the next person to sign in on the same (often shared hostel) computer.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        clearOnboardingData();
        clearSession();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionProvider>
        {children}
        <Toaster />
        <PwaStatus />
      </MotionProvider>
    </QueryClientProvider>
  );
}
