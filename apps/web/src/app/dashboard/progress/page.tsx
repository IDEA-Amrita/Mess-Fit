"use client";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, AnimatePresence } from "framer-motion";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";

const TrendChart = dynamic(() => import("@/components/ui/trend-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full rounded-xl bg-white/5" />,
});
import { Alert01Icon, FireIcon, TrendingUpDownIcon, Clock01Icon } from "@hugeicons/core-free-icons";
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
      <div className="mf-rise mx-auto w-full max-w-4xl flex-1 space-y-8 p-5 sm:p-6 lg:p-8">
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.04em", color: "#f4f4f5" }}>
              Progress
            </h1>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "#a1a1aa", marginTop: "4px" }}>
              Insights from the last {range}
            </p>
          </motion.div>
          <motion.div 
             initial={{ opacity: 0, x: 20 }} 
             animate={{ opacity: 1, x: 0 }} 
             transition={{ duration: 0.5 }}
             className="glass-card flex gap-1 p-1" style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
          >
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "relative rounded-lg px-4 py-1.5 text-[13px] font-bold transition-all",
                  r === range ? "text-accent" : "text-muted-foreground hover:text-white",
                )}
              >
                {r === range && (
                  <motion.div
                    layoutId="activeRange"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 0 10px rgba(245,158,11,0.1)" }}
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
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingSkeleton />
            </motion.div>
          ) : query.isError ? (
            <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <ErrorState error={query.error} />
            </motion.div>
          ) : query.data ? (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ProgressView data={query.data} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .glass-card {
          position: relative;
          overflow: hidden;
          border-radius: 1.5rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }
        .label-caps {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
      `}</style>
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
       variants={containerVariants}
       initial="hidden"
       animate="show"
       className="space-y-6"
    >
      <motion.section variants={itemVariants} className="glass-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="label-caps" style={{ color: "#a1a1aa" }}>Weight Trend</h3>
          {weights.length >= 2 && (
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: delta > 0 ? "rgba(248,113,113,0.1)" : delta < 0 ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.05)",
                color: delta > 0 ? "#f87171" : delta < 0 ? "#f59e0b" : "#a1a1aa",
                border: `1px solid ${delta > 0 ? "rgba(248,113,113,0.2)" : delta < 0 ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.1)"}`
              }}
            >
              {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)} kg · now {lastW.toFixed(1)} kg
            </span>
          )}
        </div>

        {series.length === 0 ? (
          <div className="py-10 text-center">
             <p style={{ fontSize: "16px", fontWeight: 700, color: "#f4f4f5" }}>No weigh-ins yet</p>
             <p className="mt-2 text-sm text-muted-foreground">Log your weight to see the trend.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <TrendChart series={series} lo={lo} hi={hi} />
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-center" style={{ color: "#52525b" }}>
              Y-axis is zoomed to your range, not zero-based.
            </p>
          </motion.div>
        )}
      </motion.section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <motion.div variants={itemVariants} whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.18)", boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6)" }} className="glass-card p-5 flex flex-col justify-between min-h-[120px] transition-all duration-300">
          <span className="label-caps" style={{ color: "#f59e0b" }}>Adherence</span>
          <span style={{ fontSize: "36px", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>{Math.round(data.adherence_rate * 100)}</motion.span><span className="text-xl text-muted-foreground">%</span>
          </span>
        </motion.div>
        <motion.div variants={itemVariants} whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.18)", boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6)" }} className="glass-card p-5 flex flex-col justify-between min-h-[120px] transition-all duration-300">
          <span className="label-caps" style={{ color: "#60a5fa" }}>Macros Hit</span>
          <span style={{ fontSize: "36px", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>{data.macro_hit_rate == null ? "—" : Math.round(data.macro_hit_rate * 100)}</motion.span><span className="text-xl text-muted-foreground">{data.macro_hit_rate != null ? "%" : ""}</span>
          </span>
        </motion.div>
        <motion.div variants={itemVariants} whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.18)", boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6)" }} className="glass-card p-5 flex flex-col justify-between min-h-[120px] transition-all duration-300">
          <span className="label-caps flex items-center gap-1.5" style={{ color: "#f87171" }}>
            <HugeiconsIcon icon={FireIcon} className="h-4 w-4" /> Streak
          </span>
          <span style={{ fontSize: "36px", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>{data.streak_days}</motion.span> <span className="text-[14px] text-muted-foreground uppercase tracking-widest">{data.streak_days === 1 ? "day" : "days"}</span>
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
      <p className="text-[13px] leading-relaxed" style={{ color: "#a1a1aa" }}>
        {projection.reason ?? "Projection unlocks once you have a few weigh-ins."} Keep logging your
        weight — projection unlocks at 5 entries.
      </p>
    );
  } else if (projection.stalled) {
    body = (
      <p className="text-[13px] leading-relaxed" style={{ color: "#a1a1aa" }}>
        Your weight is holding steady. If that&apos;s not the goal, nudge your intake.
      </p>
    );
  } else if (projection.moving_wrong_direction) {
    body = (
      <p className="text-[13px] leading-relaxed" style={{ color: "#f87171" }}>
        You&apos;re currently trending away from your goal weight. Time to adjust the plan.
      </p>
    );
  } else {
    const rate = projection.current_rate_kg_per_week ?? 0;
    const sign = rate >= 0 ? "+" : "";
    body = (
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed" style={{ color: "#e2e2e2" }}>
          At your current rate ({sign}
          {rate} kg/wk), you&apos;ll hit your goal around{" "}
          <span className="font-bold text-white">{projection.projected_target_date}</span>.
        </p>
        <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: projection.on_track ? "#f59e0b" : "#f87171" }}>
          {projection.on_track ? "✅ On track" : "⚠️ Off target pace"}
        </p>
      </div>
    );
  }

  return (
    <motion.section whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.18)", boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6)" }} className="glass-card p-6 flex flex-col transition-all duration-300">
      <div className="mb-4 flex items-center gap-2">
        <HugeiconsIcon icon={TrendingUpDownIcon} className="h-5 w-5" style={{ color: "#818cf8" }} />
        <h3 className="label-caps" style={{ color: "#818cf8" }}>Projection</h3>
      </div>
      <div className="flex-1 flex flex-col justify-end">
        {body}
      </div>
    </motion.section>
  );
}

function AdaptiveTDEECard({ adaptive }: { adaptive: Progress["adaptive_tdee"] }) {
  if (!adaptive) return null;

  return (
    <motion.section 
      whileHover={{ y: -4, borderColor: adaptive.available ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.18)", boxShadow: adaptive.available ? "0 20px 60px -20px rgba(245,158,11,0.4)" : "0 20px 60px -20px rgba(0,0,0,0.6)" }}
      className={cn(
        "glass-card p-6 flex flex-col group transition-all duration-300", 
      )}
      style={adaptive.available ? { borderColor: "rgba(245,158,11,0.3)", boxShadow: "0 0 40px rgba(245,158,11,0.05)" } : {}}
    >
      {adaptive.available && (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-50" />
      )}
      
      <div className="relative z-10 flex-1 flex flex-col">
        <div className="mb-4 flex items-center gap-2">
          <HugeiconsIcon icon={FireIcon} className="h-5 w-5" style={{ color: "#f59e0b" }} />
          <h3 className="label-caps" style={{ color: "#f59e0b" }}>Adaptive TDEE</h3>
          {adaptive.available && (
            <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
              Active
            </span>
          )}
        </div>
        
        {adaptive.available ? (
          <div className="space-y-4 flex-1 flex flex-col justify-end">
            <div className="flex items-baseline gap-2">
              <span style={{ fontSize: "40px", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>{Math.round(adaptive.tdee)}</motion.span>
              </span>
              <span className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">kcal / day</span>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: "#a1a1aa" }}>
              Your true metabolic rate, dynamically calculated from {adaptive.data_days} days of weight & food data.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: adaptive.confidence === 'high' ? '100%' : adaptive.confidence === 'medium' ? '66%' : '33%' }}
                  className="h-full rounded-full" 
                  style={{ background: "#f59e0b" }}
                  transition={{ type: "spring", stiffness: 60, damping: 15, delay: 0.5 }}
                />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider w-24 text-right" style={{ color: "#f59e0b" }}>
                {adaptive.confidence} Conf
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2 flex-1 flex flex-col justify-end">
            <p className="text-[13px] leading-relaxed" style={{ color: "#a1a1aa" }}>
              {adaptive.reason ?? "Keep logging weight and meals to unlock adaptive TDEE insights."}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }} />
              <span className="text-[10px] uppercase font-bold tracking-wider w-24 text-right" style={{ color: "#52525b" }}>
                Needs Data
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}

function LeaderboardCard() {
  const query = useQuery<LeaderboardResponse, ApiError>({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard(7),
    retry: 0,
  });

  if (query.isLoading) {
    return <Skeleton className="h-48 w-full rounded-3xl bg-white/5" />;
  }

  if (query.isError || !query.data) {
    return null; // Silent fail if leaderboard is unavailable
  }

  const { entries, user_rank } = query.data;

  return (
    <motion.section whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.18)", boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6)" }} className="glass-card p-6 mt-6 transition-all duration-300">
      <div className="mb-5 flex items-center gap-2 border-b pb-4" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <HugeiconsIcon icon={FireIcon} className="h-5 w-5" style={{ color: "#f59e0b" }} />
        <h3 className="label-caps" style={{ color: "#f59e0b" }}>College Leaderboard</h3>
        <span className="ml-auto text-[11px] font-bold uppercase tracking-wider" style={{ color: "#71717a" }}>Top Adherence (7d)</span>
      </div>

      {entries.length === 0 ? (
        <p className="text-[13px]" style={{ color: "#a1a1aa" }}>No data available yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.slice(0, 5).map((entry, idx) => {
            const isUser = user_rank?.user_id === entry.user_id;
            return (
              <motion.div 
                key={entry.user_id} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + (idx * 0.1) }}
                className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors"
                style={isUser ? { background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" } : { background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex items-center gap-4">
                  <span className="w-6 text-center text-[12px] font-bold" style={{ color: isUser ? "#f59e0b" : "#71717a" }}>
                    #{idx + 1}
                  </span>
                  <div className="h-8 w-8 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
                  <span className="text-[14px] font-bold" style={{ color: isUser ? "#f59e0b" : "#f4f4f5" }}>
                    {isUser ? "You" : `User ${entry.user_id.slice(0,4)}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[16px] font-extrabold" style={{ color: isUser ? "#f59e0b" : "#e2e2e2" }}>{entry.score}%</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}

// ── loading / error ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[300px] rounded-3xl bg-white/5" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 rounded-3xl bg-white/5" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-3xl bg-white/5" />
    </div>
  );
}

function ErrorState({ error }: { error: ApiError | null }) {
  const isOnboarding = error?.status === 409;
  return (
    <div className="glass-card flex flex-col items-center justify-center py-20 text-center mx-auto max-w-md mt-10">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
        <HugeiconsIcon icon={Alert01Icon} className="h-8 w-8" />
      </div>
      <p style={{ fontSize: "20px", fontWeight: 700, color: "#f4f4f5", marginBottom: "8px" }}>
        {isOnboarding ? "Onboarding required" : "Couldn't load progress"}
      </p>
      <p style={{ fontSize: "14px", color: "#a1a1aa", marginBottom: "24px" }}>
        {error?.detail ?? "Please try again."}
      </p>
      {isOnboarding && (
        <Link href="/onboarding/hostel" className="rounded-full px-6 py-3 text-sm font-bold transition-all hover:scale-[1.02] active:scale-95" style={{ background: "#f59e0b", color: "#1b1304" }}>
          Complete onboarding
        </Link>
      )}
    </div>
  );
}
