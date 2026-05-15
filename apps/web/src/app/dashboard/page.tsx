"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  PlateIcon,
  Target01Icon,
  Calendar01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        router.replace("/auth/login");
        return;
      }
      setEmail(data.user.email ?? null);
      setDisplayName(
        (data.user.user_metadata?.display_name as string) ?? null
      );
      setLoading(false);
    });

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
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "#080808" }}
      >
        <div
          className="h-7 w-7 animate-spin rounded-full border-2"
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            borderTopColor: "#f59e0b",
          }}
        />
      </div>
    );
  }

  const name = displayName ?? email ?? "there";
  const initial = name.charAt(0).toUpperCase();
  const firstName = displayName?.split(" ")[0] ?? "there";

  return (
    <div className="flex min-h-screen" style={{ background: "#080808" }}>
      {/* ── Sidebar (desktop) ── */}
      <aside
        className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r lg:flex"
        style={{ background: "#0d0d0d", borderColor: "rgba(255,255,255,0.07)" }}
      >
        {/* Logo */}
        <div
          className="flex h-16 shrink-0 items-center border-b px-5"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <Link href="/" className="text-lg font-bold">
            <span style={{ color: "#f0f0f0" }}>Mess</span>
            <span style={{ color: "#f59e0b" }}>Fit</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = item.href === "/dashboard";
            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                style={
                  active
                    ? {
                        background: "rgba(245,158,11,0.12)",
                        color: "#f59e0b",
                      }
                    : { color: "#555" }
                }
              >
                <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.5} color="currentColor" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div
          className="shrink-0 border-t p-3"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "rgba(245,158,11,0.18)", color: "#f59e0b" }}
            >
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xs font-medium"
                style={{ color: "#d0d0d0" }}
              >
                {displayName ?? "User"}
              </p>
              <p className="truncate text-xs" style={{ color: "#444" }}>
                {email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors"
            style={{ color: "#555" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex min-h-screen flex-1 flex-col lg:ml-60">
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

          {/* Empty state */}
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
              Phase 1 brings the smart optimizer — building your perfect plate
              from today&apos;s mess menu, hitting your exact goals.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const navItems = [
  { icon: DashboardSquare01Icon, label: "Dashboard", href: "/dashboard" },
  { icon: PlateIcon, label: "Today's Plate", href: "/dashboard/plate" },
  { icon: Target01Icon, label: "Goals", href: "/dashboard/goals" },
  { icon: Calendar01Icon, label: "History", href: "/dashboard/history" },
  { icon: Settings01Icon, label: "Settings", href: "/dashboard/settings" },
];

const statCards = [
  { label: "Calories Today", sub: "Set a goal in Phase 1" },
  { label: "Protein", sub: "Set a goal in Phase 1" },
  { label: "Meals Logged", sub: "This week" },
];
