"use client";

import { useState } from "react";
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
import { Alert01Icon, FireIcon, TrendingUp01Icon } from "@hugeicons/core-free-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { DashboardShell } from "@/components/DashboardShell";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { getProgress, type Progress, type ProgressRange } from "@/lib/tracking-api";

const RANGES: ProgressRange[] = ["7d", "30d", "90d"];
const CARD = "rounded-xl border border-border bg-card";

export default function ProgressPage() {
  const [range, setRange] = useState<ProgressRange>("7d");

  const query = useQuery<Progress, ApiError>({
    queryKey: ["progress", range],
    queryFn: () => getProgress(range),
    retry: 0,
  });

  return (
    <DashboardShell>
      <div className="mf-rise mx-auto w-full max-w-3xl flex-1 space-y-5 p-5 sm:p-6">
        <PageHeader
          title="Progress"
          description={`Last ${range}`}
          actions={
            <div className={cn("flex gap-1 p-1", CARD)}>
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    r === range ? "bg-accent-muted text-accent" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          }
        />

        {query.isLoading ? (
          <LoadingSkeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : query.data ? (
          <ProgressView data={query.data} />
        ) : null}
      </div>
    </DashboardShell>
  );
}

// ── view ───────────────────────────────────────────────────────────────────

function ProgressView({ data }: { data: Progress }) {
  const series = data.weight_series.map((p) => ({ date: p.date.slice(5), weight: p.weight_kg }));
  const weights = series.map((s) => s.weight);
  const lo = weights.length ? Math.floor(Math.min(...weights) - 1) : 0;
  const hi = weights.length ? Math.ceil(Math.max(...weights) + 1) : 1;
  const delta = weights.length >= 2 ? weights[weights.length - 1] - weights[0] : 0;
  const lastW = weights[weights.length - 1];

  return (
    <div className="space-y-5">
      <section className={cn("p-4", CARD)}>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-foreground">Weight</h3>
          {weights.length >= 2 && (
            <span
              className="text-xs font-medium"
              style={{ color: delta > 0 ? "#60a5fa" : delta < 0 ? "#f59e0b" : "var(--text-muted)" }}
            >
              {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)} kg · now {lastW.toFixed(1)} kg
            </span>
          )}
        </div>

        {series.length === 0 ? (
          <EmptyState title="No weigh-ins yet" description="Log your weight to see the trend." />
        ) : (
          <>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#5e5e68", fontSize: 11 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[lo, hi]}
                    tick={{ fill: "#5e5e68", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#17171c",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#a1a1aa" }}
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
            <p className="mt-1 text-[11px] text-muted-foreground/50">
              Y-axis is zoomed to your range, not zero-based.
            </p>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Adherence" value={`${Math.round(data.adherence_rate * 100)}%`} accent />
        <StatCard
          label="Macros hit"
          value={data.macro_hit_rate == null ? "—" : `${Math.round(data.macro_hit_rate * 100)}%`}
          hint={data.macro_hit_rate == null ? "Log meals as planned" : undefined}
        />
        <StatCard
          label="Streak"
          value={`${data.streak_days}`}
          unit={data.streak_days === 1 ? "day" : "days"}
          icon={<FireIcon className="h-4 w-4" />}
          accent
        />
      </div>

      <ProjectionCard projection={data.projection} />
    </div>
  );
}

function ProjectionCard({ projection }: { projection: Progress["projection"] }) {
  let body: React.ReactNode;

  if (!projection.available) {
    body = (
      <p className="text-sm leading-relaxed text-muted-foreground">
        {projection.reason ?? "Projection unlocks once you have a few weigh-ins."} Keep logging your
        weight — projection unlocks at 5 entries.
      </p>
    );
  } else if (projection.stalled) {
    body = (
      <p className="text-sm leading-relaxed text-muted-foreground">
        Your weight is holding steady. If that&apos;s not the goal, nudge your intake.
      </p>
    );
  } else if (projection.moving_wrong_direction) {
    body = (
      <p className="text-sm leading-relaxed text-destructive">
        You&apos;re currently trending away from your goal weight. Time to adjust the plan.
      </p>
    );
  } else {
    const rate = projection.current_rate_kg_per_week ?? 0;
    const sign = rate >= 0 ? "+" : "";
    body = (
      <div className="space-y-1.5">
        <p className="text-sm leading-relaxed text-foreground/80">
          At your current rate ({sign}
          {rate} kg/wk), you&apos;ll hit your goal around{" "}
          <span className="font-semibold text-foreground">{projection.projected_target_date}</span>.
        </p>
        <p className={cn("text-sm font-medium", projection.on_track ? "text-accent" : "text-destructive")}>
          {projection.on_track ? "✅ On track" : "⚠️ Off your target pace"}
        </p>
      </div>
    );
  }

  return (
    <section className={cn("p-4", CARD)}>
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp01Icon className="h-4 w-4" style={{ color: "#818cf8" }} />
        <h3 className="text-sm font-semibold text-foreground">Projection</h3>
      </div>
      {body}
    </section>
  );
}

// ── loading / error ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-64 rounded-xl bg-white/5" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl bg-white/5" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-xl bg-white/5" />
    </div>
  );
}

function ErrorState({ error }: { error: ApiError | null }) {
  const isOnboarding = error?.status === 409;
  return (
    <EmptyState
      icon={<Alert01Icon className="h-6 w-6" />}
      title={isOnboarding ? "Onboarding required" : "Couldn't load progress"}
      description={error?.detail ?? "Please try again."}
      action={
        isOnboarding ? (
          <Link href="/onboarding/hostel" className={buttonVariants({ variant: "default" })}>
            Complete onboarding
          </Link>
        ) : undefined
      }
    />
  );
}
