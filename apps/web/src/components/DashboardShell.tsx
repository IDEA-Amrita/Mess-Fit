"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  PlateIcon,
  Dumbbell01Icon,
  Target01Icon,
  Calendar01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { icon: DashboardSquare01Icon, label: "Dashboard", href: "/dashboard", comingSoon: false },
  { icon: PlateIcon, label: "Menu", href: "/menu", comingSoon: false },
  { icon: PlateIcon, label: "Today's Plate", href: "/dashboard/plate", comingSoon: false },
  { icon: Dumbbell01Icon, label: "Workout", href: "/dashboard/workout", comingSoon: false },
  { icon: Target01Icon, label: "Goals", href: "/dashboard/goals", comingSoon: true },
  { icon: Calendar01Icon, label: "History", href: "/dashboard/history", comingSoon: true },
  { icon: Settings01Icon, label: "Settings", href: "/dashboard/settings", comingSoon: true },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? null);
        setDisplayName((data.user.user_metadata?.display_name as string) ?? null);
      }
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  const name = displayName ?? email ?? "there";
  const initial = name.charAt(0).toUpperCase();

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
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const disabled = item.comingSoon;
            const inner = (
              <>
                <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.5} color="currentColor" />
                <span className="flex-1">{item.label}</span>
                {disabled && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#444" }}
                  >
                    Soon
                  </span>
                )}
              </>
            );
            const baseClasses =
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";
            const activeStyle = active
              ? { background: "rgba(245,158,11,0.12)", color: "#f59e0b" }
              : { color: disabled ? "#3a3a3a" : "#555" };

            if (disabled) {
              return (
                <div
                  key={item.label}
                  aria-disabled="true"
                  className={`${baseClasses} cursor-not-allowed opacity-60`}
                  style={activeStyle}
                >
                  {inner}
                </div>
              );
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                className={baseClasses}
                style={activeStyle}
              >
                {inner}
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
              <p className="truncate text-xs font-medium" style={{ color: "#d0d0d0" }}>
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
        {children}
      </main>
    </div>
  );
}
