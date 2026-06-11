"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlateIcon } from "@hugeicons/core-free-icons";
import { supabase } from "@/lib/supabase";
import { DashboardShell } from "@/components/DashboardShell";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? null);
        setDisplayName(
          (data.user.user_metadata?.display_name as string) ?? null
        );
      }
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  const firstName = displayName?.split(" ")[0] ?? "there";

  return (
    <DashboardShell>
      {/* Top bar */}
      <header
        className="flex h-16 shrink-0 items-center justify-between border-b px-6"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div>
          <h1
            className="text-base font-semibold"
            style={{ color: "#f0f0f0" }}
          >
            Good {timeOfDay()}, {firstName} 👋
          </h1>
          <p className="text-xs" style={{ color: "#444" }}>
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>

        {/* Mobile sign-out */}
        <button
          onClick={handleLogout}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium lg:hidden"
          style={{
            borderColor: "rgba(255,255,255,0.1)",
            color: "#666",
          }}
        >
          Sign out
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 space-y-5 p-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl p-5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#444" }}
              >
                {card.label}
              </p>
              <p
                className="mt-2 text-3xl font-bold"
                style={{ color: "#f0f0f0" }}
              >
                —
              </p>
              <p className="mt-1 text-xs" style={{ color: "#444" }}>
                {card.sub}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          className="flex min-h-72 flex-col items-center justify-center rounded-2xl p-8 text-center"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px dashed rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "rgba(245,158,11,0.1)" }}
          >
            <HugeiconsIcon icon={PlateIcon} size={28} strokeWidth={1.5} color="#f59e0b" />
          </div>
          <p className="font-semibold" style={{ color: "#d0d0d0" }}>
            Your plate is empty for now
          </p>
          <p
            className="mt-2 max-w-xs text-sm leading-relaxed"
            style={{ color: "#444" }}
          >
            Head to{" "}
            <a
              href="/dashboard/plate"
              style={{ color: "#f59e0b" }}
              className="underline underline-offset-2"
            >
              Today&apos;s Plate
            </a>{" "}
            to see your personalised meal plan from today&apos;s mess menu.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const statCards = [
  { label: "Calories Today", sub: "See Today's Plate" },
  { label: "Protein", sub: "See Today's Plate" },
  { label: "Meals Logged", sub: "This week" },
];
