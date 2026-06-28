"use client";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, AnimatePresence } from "framer-motion";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";

const TrendChart = dynamic(() => import("@/components/ui/trend-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full rounded-[1.5rem] bg-surface" />,
});
import { Alert01Icon, FireIcon, TrendingUpDownIcon } from "@hugeicons/core-free-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardShell } from "@/components/DashboardShell";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { getProgress, getLeaderboard, type Progress, type ProgressRange, type LeaderboardResponse } from "@/lib/tracking-api";

const RANGES: ProgressRange[] = ["7d", "30d", "90d"];

export default function ProgressPage() {
  const [range, setRange] = useState<ProgressRange>("7d");

  const query = useQuery<Progress, ApiError>({
    queryKey: ["progress", range],
    queryFn: () => getProgress(range),
    retry: 0,
  });

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-4xl flex-1 p-5 sm:p-6 lg:p-8">
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-[13px] font-bold text-accent uppercase tracking-widest mb-1">
              Insights · {range}
            </p>
            <h1 className="heading-heavy">Progress</h1>
          </motion.div>
          <motion.div 
             initial={{ opacity: 0, x: 20 }} 
             animate={{ opacity: 1, x: 0 }} 
             transition={{ duration: 0.5 }}
             className="flex gap-1 p-1 rounded-xl bg-surface-2"
          >
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "relative rounded-lg px-5 py-2 text-[12px] font-black uppercase tracking-widest transition-colors",
                  r === range ? "text-black" : "text-muted-foreground hover:text-white",
                )}
              >
                {r === range && (
                  <motion.div
                    layoutId="activeRange"
                    className="absolute inset-0 rounded-lg bg-white"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{r}</span>
              </button>
            ))}
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {query.isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-10">
              <LoadingSkeleton />
            </motion.div>
          ) : query.isError ? (
            <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-10">
              <ErrorState error={query.error} />
            </motion.div>
          ) : query.data ? (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10">
              <ProgressView data={query.data} />
            </motion.div>
          ) : null}
        </AnimatePresence>
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

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4">
      <motion.section variants={itemVariants} className="surface-card p-6">
        <div className="mb-6 flex items-baseline justify-between">
          <h3 className="label-caps text-white">Weight Trend</h3>
          {weights.length >= 2 && (
            <span
              className="rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-widest"
              style={{
                background: delta > 0 ? "rgba(255,59,48,0.15)" : delta < 0 ? "rgba(204,255,0,0.15)" : "var(--surface-2)",
                color: delta > 0 ? "#FF3B30" : delta < 0 ? "var(--accent)" : "var(--muted-foreground)"
              }}
            >
              {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)} kg · now {lastW.toFixed(1)} kg
            </span>
          )}
        </div>

        {series.length === 0 ? (
          <div className="py-10 text-center">
             <p className="text-[16px] font-bold text-white">No weigh-ins yet</p>
             <p className="mt-2 text-[13px] font-medium text-muted-foreground">Log your weight to see the trend.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <TrendChart series={series} lo={lo} hi={hi} />
          </motion.div>
        )}
      </motion.section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <motion.div variants={itemVariants} className="surface-card p-6 flex flex-col justify-between min-h-[140px] bg-surface-2">
          <span className="label-caps">Adherence</span>
          <span className="text-[40px] font-black text-white tracking-tighter">
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>{Math.round(data.adherence_rate * 100)}</motion.span><span className="text-xl text-muted-foreground">%</span>
          </span>
        </motion.div>
        <motion.div variants={itemVariants} className="surface-card p-6 flex flex-col justify-between min-h-[140px] bg-surface-2">
          <span className="label-caps">Macros Hit</span>
          <span className="text-[40px] font-black text-white tracking-tighter">
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>{data.macro_hit_rate == null ? "—" : Math.round(data.macro_hit_rate * 100)}</motion.span><span className="text-xl text-muted-foreground">{data.macro_hit_rate != null ? "%" : ""}</span>
          </span>
        </motion.div>
        <motion.div variants={itemVariants} className="surface-card p-6 flex flex-col justify-between min-h-[140px] bg-surface-2">
          <span className="label-caps flex items-center gap-1.5 text-white">
            <HugeiconsIcon icon={FireIcon} className="h-4 w-4 text-[#FF3B30]" /> Streak
          </span>
          <span className="text-[40px] font-black text-white tracking-tighter">
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>{data.streak_days}</motion.span> <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest ml-1">{data.streak_days === 1 ? "day" : "days"}</span>
          </span>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <motion.div variants={itemVariants}>
           <ProjectionCard projection={data.projection} />
        </motion.div>
        {data.adaptive_tdee && (
          <motion.div variants={itemVariants}>
            <AdaptiveTDEECard adaptive={data.adaptive_tdee} />
          </motion.div>
        )}
      </div>

      <motion.div variants={itemVariants}>
        <LeaderboardCard />
      </motion.div>
    </motion.div>
  );
}

function ProjectionCard({ projection }: { projection: Progress["projection"] }) {
  let body: React.ReactNode;

  if (!projection.available) {
    body = (
      <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
        {projection.reason ?? "Projection unlocks once you have a few weigh-ins."}
      </p>
    );
  } else if (projection.stalled) {
    body = (
      <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
        Your weight is holding steady. If that&apos;s not the goal, nudge your intake.
      </p>
    );
  } else if (projection.moving_wrong_direction) {
    body = (
      <p className="text-[13px] font-medium text-[#FF3B30] leading-relaxed">
        You&apos;re currently trending away from your goal weight.
      </p>
    );
  } else {
    const rate = projection.current_rate_kg_per_week ?? 0;
    const sign = rate >= 0 ? "+" : "";
    body = (
      <div className="space-y-4">
        <p className="text-[14px] font-bold text-white leading-relaxed">
          At {sign}{rate} kg/wk, you&apos;ll hit your goal by{" "}
          <span className="text-accent">{projection.projected_target_date}</span>.
        </p>
        <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: projection.on_track ? "var(--accent)" : "#FF3B30" }}>
          {projection.on_track ? "On track" : "Off pace"}
        </p>
      </div>
    );
  }

  return (
    <section className="surface-card p-6 flex flex-col h-full min-h-[180px]">
      <div className="mb-4 flex items-center gap-2">
        <HugeiconsIcon icon={TrendingUpDownIcon} className="h-5 w-5 text-white" />
        <h3 className="label-caps text-white">Projection</h3>
      </div>
      <div className="flex-1 flex flex-col justify-end">
        {body}
      </div>
    </section>
  );
}

function AdaptiveTDEECard({ adaptive }: { adaptive: Progress["adaptive_tdee"] }) {
  if (!adaptive) return null;

  return (
    <section className="surface-card p-6 flex flex-col h-full min-h-[180px]">
      <div className="relative z-10 flex-1 flex flex-col">
        <div className="mb-4 flex items-center gap-2">
          <HugeiconsIcon icon={FireIcon} className="h-5 w-5 text-accent" />
          <h3 className="label-caps text-white">Adaptive TDEE</h3>
          {adaptive.available && (
            <span className="ml-auto rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-accent text-black">
              Active
            </span>
          )}
        </div>
        
        {adaptive.available ? (
          <div className="space-y-4 flex-1 flex flex-col justify-end">
            <div className="flex items-baseline gap-2">
              <span className="text-[40px] font-black text-white tracking-tighter">
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>{Math.round(adaptive.tdee)}</motion.span>
              </span>
              <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">kcal / day</span>
            </div>
            <p className="text-[12px] font-medium text-muted-foreground leading-relaxed">
              Based on {adaptive.data_days} days of data.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div className="h-1.5 flex-1 rounded-full overflow-hidden bg-surface-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: adaptive.confidence === 'high' ? '100%' : adaptive.confidence === 'medium' ? '66%' : '33%' }}
                  className="h-full rounded-full bg-white" 
                  transition={{ type: "spring", stiffness: 60, damping: 15, delay: 0.5 }}
                />
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest w-24 text-right text-white">
                {adaptive.confidence} Conf
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2 flex-1 flex flex-col justify-end">
            <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
              {adaptive.reason ?? "Keep logging weight and meals to unlock."}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-surface-2" />
              <span className="text-[10px] font-black uppercase tracking-widest w-24 text-right text-muted-foreground">
                Needs Data
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function LeaderboardCard() {
  const query = useQuery<LeaderboardResponse, ApiError>({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard(7),
    retry: 0,
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full rounded-[1.5rem] bg-surface" />;
  if (query.isError || !query.data) return null; 

  const { entries, user_rank } = query.data;

  return (
    <section className="surface-card p-6 mt-6">
      <div className="mb-6 flex items-center gap-2 border-b border-border pb-4">
        <HugeiconsIcon icon={FireIcon} className="h-5 w-5 text-accent" />
        <h3 className="label-caps text-white">Leaderboard</h3>
        <span className="ml-auto text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Top Adherence (7d)</span>
      </div>

      {entries.length === 0 ? (
        <p className="text-[13px] font-medium text-muted-foreground">No data available yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.slice(0, 5).map((entry, idx) => {
            const isUser = user_rank?.user_id === entry.user_id;
            return (
              <motion.div 
                key={entry.user_id} 
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + (idx * 0.1) }}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-3 transition-colors",
                  isUser ? "bg-surface-2 border-l-4 border-accent" : "bg-surface"
                )}
              >
                <div className="flex items-center gap-4">
                  <span className={cn("w-6 text-center text-[13px] font-black", isUser ? "text-accent" : "text-muted-foreground")}>
                    #{idx + 1}
                  </span>
                  <div className="h-8 w-8 rounded-full bg-surface-2 border border-border" />
                  <span className={cn("text-[14px] font-bold", isUser ? "text-white" : "text-muted-foreground")}>
                    {isUser ? "You" : `User ${entry.user_id.slice(0,4)}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className={cn("block text-[16px] font-black tracking-tight", isUser ? "text-white" : "text-muted-foreground")}>{entry.score}%</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[300px] rounded-[1.5rem] bg-surface" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-[1.5rem] bg-surface" />)}
      </div>
      <Skeleton className="h-40 rounded-[1.5rem] bg-surface" />
    </div>
  );
}

function ErrorState({ error }: { error: ApiError | null }) {
  return (
    <div className="surface-card flex flex-col items-center justify-center py-20 text-center mx-auto max-w-md">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#FF3B30]/10 text-[#FF3B30]">
        <HugeiconsIcon icon={Alert01Icon} className="h-8 w-8" />
      </div>
      <p className="text-xl font-bold text-white mb-2">Couldn't load progress</p>
      <p className="text-[14px] font-medium text-muted-foreground">{error?.detail ?? "Please try again."}</p>
    </div>
  );
}
