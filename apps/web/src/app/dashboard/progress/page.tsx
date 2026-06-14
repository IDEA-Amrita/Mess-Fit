"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle, Flame, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { DashboardShell } from "@/components/DashboardShell";
import { ApiError } from "@/lib/api";
import { getProgress, type Progress, type ProgressRange } from "@/lib/tracking-api";

const RANGES: ProgressRange[] = ["7d", "30d", "90d"];

export default function ProgressPage() {
  const router = useRouter();
  const [range, setRange] = useState<ProgressRange>("7d");

  const query = useQuery<Progress, ApiError>({
    queryKey: ["progress", range],
    queryFn: () => getProgress(range),
    retry: 0,
  });

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  return (
    <DashboardShell>
      <header
        className="flex h-16 shrink-0 items-center justify-between border-b px-6"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: "#f0f0f0" }}>
            Progress
          </h1>
          <p className="text-xs" style={{ color: "#444" }}>
            Last {range}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex gap-1 rounded-lg p-1"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                style={
                  r === range
                    ? { background: "rgba(245,158,11,0.16)", color: "#f59e0b" }
                    : { color: "#666" }
                }
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium lg:hidden"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "#666" }}
          >
            Sign out
          </button>
        </div>
      </header>

      {query.isLoading ? (
        <LoadingSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : query.data ? (
        <ProgressView data={query.data} />
      ) : null}
    </DashboardShell>
  );
}

// ── view ───────────────────────────────────────────────────────────────────

function ProgressView({ data }: { data: Progress }) {
  const series = data.weight_series.map((p) => ({
    date: p.date.slice(5), // MM-DD
    weight: p.weight_kg,
  }));

  // Honest y-axis: pad around the data range instead of zero-basing (a 1kg
  // wiggle shouldn't look like a cliff), but never imply a zero baseline.
  const weights = series.map((s) => s.weight);
  const lo = weights.length ? Math.floor(Math.min(...weights) - 1) : 0;
  const hi = weights.length ? Math.ceil(Math.max(...weights) + 1) : 1;

  const firstW = weights[0];
  const lastW = weights[weights.length - 1];
  const delta = weights.length >= 2 ? lastW - firstW : 0;

  return (
    <div className="flex-1 space-y-5 p-6">
      {/* Weight chart */}
      <section
        className="rounded-2xl p-4"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "#c0c0c0" }}>
            Weight
          </h3>
          {weights.length >= 2 && (
            <span
              className="text-xs font-medium"
              style={{ color: delta > 0 ? "#60a5fa" : delta < 0 ? "#f59e0b" : "#555" }}
            >
              {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)} kg · now {lastW.toFixed(1)} kg
            </span>
          )}
        </div>

        {series.length === 0 ? (
          <EmptyHint text="No weigh-ins yet. Log your weight to see the trend." />
        ) : (
          <>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#555", fontSize: 11 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[lo, hi]}
                    tick={{ fill: "#555", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#141414",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#888" }}
                    formatter={(v: number) => [`${v} kg`, "Weight"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#f59e0b" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[11px]" style={{ color: "#2f2f2f" }}>
              Y-axis is zoomed to your range, not zero-based.
            </p>
          </>
        )}
      </section>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Adherence" value={`${Math.round(data.adherence_rate * 100)}%`} />
        <StatCard
          label="Macros hit"
          value={data.macro_hit_rate == null ? "—" : `${Math.round(data.macro_hit_rate * 100)}%`}
          hint={data.macro_hit_rate == null ? "Log meals as planned" : undefined}
        />
        <StatCard
          label="Streak"
          value={`${data.streak_days}`}
          suffix={data.streak_days === 1 ? "day" : "days"}
          icon={<Flame className="h-4 w-4" style={{ color: "#f59e0b" }} />}
        />
      </div>

      {/* Projection */}
      <ProjectionCard projection={data.projection} />
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  hint,
  icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-2 text-3xl font-bold" style={{ color: "#f0f0f0" }}>
        {value}
        {suffix && <span className="ml-1 text-sm font-medium" style={{ color: "#555" }}>{suffix}</span>}
      </p>
      {hint && (
        <p className="mt-1 text-xs" style={{ color: "#3a3a3a" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function ProjectionCard({ projection }: { projection: Progress["projection"] }) {
  let body: React.ReactNode;

  if (!projection.available) {
    body = (
      <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
        {projection.reason ?? "Projection unlocks once you have a few weigh-ins."} Keep logging
        your weight — projection unlocks at 5 entries.
      </p>
    );
  } else if (projection.stalled) {
    body = (
      <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
        Your weight is holding steady. If that&apos;s not the goal, nudge your intake.
      </p>
    );
  } else if (projection.moving_wrong_direction) {
    body = (
      <p className="text-sm leading-relaxed" style={{ color: "#f87171" }}>
        You&apos;re currently trending away from your goal weight. Time to adjust the plan.
      </p>
    );
  } else {
    const rate = projection.current_rate_kg_per_week ?? 0;
    const sign = rate >= 0 ? "+" : "";
    body = (
      <div className="space-y-1.5">
        <p className="text-sm leading-relaxed" style={{ color: "#c0c0c0" }}>
          At your current rate ({sign}
          {rate} kg/wk), you&apos;ll hit your goal around{" "}
          <span style={{ color: "#f0f0f0", fontWeight: 600 }}>
            {projection.projected_target_date}
          </span>
          .
        </p>
        <p
          className="text-sm font-medium"
          style={{ color: projection.on_track ? "#f59e0b" : "#f87171" }}
        >
          {projection.on_track ? "✅ On track" : "⚠️ Off your target pace"}
        </p>
      </div>
    );
  }

  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp className="h-4 w-4" style={{ color: "#818cf8" }} />
        <h3 className="text-sm font-semibold" style={{ color: "#c0c0c0" }}>
          Projection
        </h3>
      </div>
      {body}
    </section>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div
      className="flex min-h-40 items-center justify-center rounded-xl p-6 text-center text-sm"
      style={{ border: "1px dashed rgba(255,255,255,0.06)", color: "#444" }}
    >
      {text}
    </div>
  );
}

// ── loading / error ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5 p-6">
      <Skeleton className="h-64 rounded-2xl bg-white/5" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl bg-white/5" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-2xl bg-white/5" />
    </div>
  );
}

function ErrorState({ error }: { error: ApiError | null }) {
  const isOnboarding = error?.status === 409;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "rgba(248,113,113,0.1)" }}
      >
        <AlertCircle className="w-7 h-7" style={{ color: "#f87171" }} />
      </div>
      <div>
        <p className="font-semibold" style={{ color: "#d0d0d0" }}>
          {isOnboarding ? "Onboarding required" : "Couldn't load progress"}
        </p>
        <p className="mt-1 max-w-xs text-sm leading-relaxed" style={{ color: "#555" }}>
          {error?.detail ?? "Please try again."}
        </p>
      </div>
      {isOnboarding && (
        <Link
          href="/onboarding/hostel"
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
        >
          Complete onboarding
        </Link>
      )}
    </div>
  );
}
