"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/dashboard");
      }
    });

    // Check immediately in case the session was already processed from URL hash
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/dashboard");
    });

    // Fallback: redirect to login if nothing happens after 5 s
    const timeout = setTimeout(() => {
      router.replace("/auth/login");
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4"
      style={{ background: "#080808" }}
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2"
        style={{
          borderColor: "rgba(255,255,255,0.12)",
          borderTopColor: "#f59e0b",
        }}
      />
      <p className="text-sm" style={{ color: "#555" }}>
        Signing you in…
      </p>
    </div>
  );
}
