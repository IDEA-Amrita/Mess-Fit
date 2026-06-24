"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlateIcon,
  Dumbbell01Icon,
  AiChat01Icon,
  Analytics01Icon,
  FireIcon,
  Target01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { useUser } from "@/hooks/use-user";
import { DashboardShell } from "@/components/DashboardShell";
import { getTodayLogs } from "@/lib/tracking-api";
import { optimizeToday, type OptimizationResult } from "@/lib/optimizer-api";

export default function DashboardPage() {
  const { data: user } = useUser();
  const displayName = user?.user_metadata?.display_name as string | undefined;

  const todayLogs = useQuery({
    queryKey: ["logs", "today"],
    queryFn: getTodayLogs,
    retry: 1,
    staleTime: 0,
  });

  const plate = useQuery<OptimizationResult>({
    queryKey: ["plate", "today"],
    queryFn: optimizeToday,
    retry: 0,
    staleTime: 0,
  });

  const plannedKcal = plate.data?.daily_totals?.kcal;
  const plannedProtein = plate.data?.daily_totals?.protein_g;
  const mealsLogged = todayLogs.data?.meals?.length ?? 0;

  const firstName = displayName?.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <DashboardShell>
      <div className="mf-rise mx-auto w-full max-w-6xl flex-1 p-5 sm:p-6 lg:p-8">
        {/* ── Greeting ── */}
        <div className="mb-8">
          <h1
            style={{
              fontSize: "clamp(24px, 3vw, 32px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#f4f4f5",
            }}
          >
            Good {timeOfDay()}, {firstName} 👋
          </h1>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: "#a1a1aa",
              marginTop: "4px",
            }}
          >
            {today}
          </p>
        </div>

        {/* ── Bento Grid ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* HERO: AI Plate Card (8 cols) */}
          <Link
            href="/dashboard/plate"
            className="glass-card group md:col-span-8"
            style={{ minHeight: "280px" }}
          >
            {/* Amber glow */}
            <div
              className="pointer-events-none absolute bottom-0 right-0 h-3/4 w-3/4 rounded-[inherit] opacity-30 transition-opacity group-hover:opacity-50"
              style={{
                background:
                  "radial-gradient(ellipse at 100% 100%, rgba(245,158,11,0.2) 0%, transparent 70%)",
              }}
            />
            <div className="relative z-10 flex h-full flex-col justify-between p-6 lg:p-8">
              <div className="flex items-center justify-between">
                <span className="label-caps text-accent">Today&apos;s Plate</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition-colors group-hover:bg-accent group-hover:text-black">
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-3">
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: "clamp(36px, 5vw, 56px)",
                      fontWeight: 800,
                      letterSpacing: "-0.04em",
                      background: "linear-gradient(135deg, #d97706, #f59e0b, #fbbf24)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {plannedKcal != null ? Math.round(plannedKcal).toLocaleString() : "—"}
                  </span>
                  <span style={{ fontSize: "18px", fontWeight: 600, color: "#a1a1aa" }}>
                    kcal
                  </span>
                </div>
                {/* Macro breakdown bar */}
                <div className="mt-4 flex gap-1 overflow-hidden rounded-full" style={{ height: "6px" }}>
                  <div className="rounded-full" style={{ flex: 3, background: "#60a5fa" }} />
                  <div className="rounded-full" style={{ flex: 5, background: "#fbbf24" }} />
                  <div className="rounded-full" style={{ flex: 2, background: "#f87171" }} />
                </div>
                <div className="mt-2 flex gap-4">
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#60a5fa" }}>
                    P {plannedProtein != null ? Math.round(plannedProtein) : "—"}g
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#fbbf24" }}>
                    C —g
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#f87171" }}>
                    F —g
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Workout Card (4 cols) */}
          <Link
            href="/dashboard/workout"
            className="glass-card group md:col-span-4"
            style={{ minHeight: "280px" }}
          >
            <div
              className="pointer-events-none absolute bottom-0 left-0 h-3/4 w-3/4 rounded-[inherit] opacity-20"
              style={{
                background:
                  "radial-gradient(ellipse at 0% 100%, rgba(143,213,255,0.15) 0%, transparent 70%)",
              }}
            />
            <div className="relative z-10 flex h-full flex-col justify-between p-6 lg:p-8">
              <div className="flex items-center justify-between">
                <span className="label-caps" style={{ color: "#8fd5ff" }}>Training</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition-colors group-hover:bg-white/10">
                  <HugeiconsIcon icon={Dumbbell01Icon} size={16} color="#8fd5ff" />
                </div>
              </div>
              <div>
                <p
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: "#f4f4f5",
                  }}
                >
                  Today&apos;s Workout
                </p>
                <p style={{ fontSize: "14px", color: "#a1a1aa", marginTop: "4px" }}>
                  Log your sets and track progress
                </p>
                <div
                  className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all group-hover:bg-white/10"
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#e2e2e2",
                  }}
                >
                  Start Workout
                  <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                </div>
              </div>
            </div>
          </Link>

          {/* Metrics Row */}
          <MetricCard
            label="Protein"
            value={plannedProtein != null ? `${Math.round(plannedProtein)}g` : "—"}
            icon={Target01Icon}
            iconColor="#60a5fa"
            progress={plannedProtein != null ? Math.min(plannedProtein / 150, 1) : 0}
            progressColor="#60a5fa"
          />
          <MetricCard
            label="Meals Logged"
            value={String(mealsLogged)}
            icon={PlateIcon}
            iconColor="#22c55e"
            progress={mealsLogged / 4}
            progressColor="#22c55e"
          />
          <MetricCard
            label="Streak"
            value="—"
            icon={FireIcon}
            iconColor="#f59e0b"
            accent
          />

          {/* Bottom Row */}
          <Link href="/dashboard/chat" className="glass-card group md:col-span-6" style={{ minHeight: "180px" }}>
            <div className="relative z-10 flex h-full flex-col justify-between p-6">
              <div className="flex items-center justify-between">
                <span className="label-caps" style={{ color: "#a855f7" }}>AI Coach</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition-colors group-hover:bg-white/10">
                  <HugeiconsIcon icon={AiChat01Icon} size={16} color="#a855f7" />
                </div>
              </div>
              <div>
                <p style={{ fontSize: "15px", color: "#a1a1aa", lineHeight: 1.5 }}>
                  Ask your AI nutrition &amp; fitness coach anything — backed by evidence-based sources.
                </p>
                <div
                  className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all group-hover:bg-white/10"
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#e2e2e2",
                  }}
                >
                  Ask Coach
                  <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                </div>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/progress" className="glass-card group md:col-span-6" style={{ minHeight: "180px" }}>
            <div className="relative z-10 flex h-full flex-col justify-between p-6">
              <div className="flex items-center justify-between">
                <span className="label-caps" style={{ color: "#fbbf24" }}>Progress</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 transition-colors group-hover:bg-white/10">
                  <HugeiconsIcon icon={Analytics01Icon} size={16} color="#fbbf24" />
                </div>
              </div>
              <div>
                <p style={{ fontSize: "15px", color: "#a1a1aa", lineHeight: 1.5 }}>
                  Track your weight trends, adherence, and adaptive TDEE over time.
                </p>
                <div
                  className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all group-hover:bg-white/10"
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#e2e2e2",
                  }}
                >
                  View Progress
                  <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Glass card styles */}
      <style jsx>{`
        .glass-card {
          position: relative;
          overflow: hidden;
          border-radius: 1.5rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
        }
        .glass-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.18);
          box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.6);
        }
        .label-caps {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
      `}</style>
    </DashboardShell>
  );
}

function MetricCard({
  label,
  value,
  icon,
  iconColor,
  progress,
  progressColor,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof PlateIcon;
  iconColor: string;
  progress?: number;
  progressColor?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="glass-card md:col-span-4"
      style={{ minHeight: "160px" }}
    >
      <div className="relative z-10 flex h-full flex-col justify-between p-6">
        <div className="flex items-center justify-between">
          <span className="label-caps" style={{ color: iconColor }}>
            {label}
          </span>
          <HugeiconsIcon icon={icon} size={18} color={iconColor} />
        </div>
        <div>
          <span
            className="tabular-nums"
            style={{
              fontSize: "36px",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: accent ? "#f59e0b" : "#f4f4f5",
            }}
          >
            {value}
          </span>
          {progress != null && progressColor && (
            <div
              className="mt-3 overflow-hidden rounded-full"
              style={{ height: "4px", background: "rgba(255,255,255,0.05)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(progress * 100, 100)}%`,
                  background: progressColor,
                  boxShadow: `0 0 12px ${progressColor}40`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .glass-card {
          position: relative;
          overflow: hidden;
          border-radius: 1.5rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.18);
          box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.6);
        }
        .label-caps {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
