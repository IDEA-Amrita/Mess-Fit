"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * OAuth callback handler.
 *
 * After Google/GitHub redirects back here with the auth code in the
 * URL hash, Supabase's client library automatically exchanges it for
 * a session. We wait for that, then redirect to /dashboard (the
 * middleware will further redirect to /onboarding if no profile exists).
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // The provider redirects back with ?error_description=… when the user
    // cancels or the sign-in fails; say so instead of just showing the login page.
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const failure = search.get("error_description") ?? hash.get("error_description");
    if (failure) {
      router.replace(`/auth/login?error=${encodeURIComponent(failure)}`);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        router.replace("/dashboard");
      }
    });

    // Also check immediately — session might already be set from URL hash
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/dashboard");
    });

    // Fallback: if nothing happens in 8s, go to login
    const timeout = setTimeout(() => {
      router.replace(`/auth/login?error=${encodeURIComponent("Sign-in didn't complete. Please try again.")}`);
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2"
        style={{
          borderColor: "rgba(255,255,255,0.12)",
          borderTopColor: "#ccff00",
        }}
      />
      <p role="status" className="text-sm text-muted-foreground">
        Signing you in…
      </p>
    </div>
  );
}
