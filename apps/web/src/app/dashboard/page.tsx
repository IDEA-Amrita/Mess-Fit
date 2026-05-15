"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;

      if (error || !data.user) {
        router.replace("/auth/login");
        return;
      }

      setEmail(data.user.email ?? null);
      setDisplayName((data.user.user_metadata?.display_name as string) ?? null);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-3xl font-bold">Welcome, {displayName ?? email}</h1>
      <p className="text-muted-foreground">
        Your plate is empty for now — Phase 1 will fill it.
      </p>
      <Button onClick={handleLogout} variant="outline">
        Log out
      </Button>
    </main>
  );
}
