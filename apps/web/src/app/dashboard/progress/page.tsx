"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert01Icon,
  Award01Icon,
  FireIcon,
  LockIcon,
  SparklesIcon,
  Target01Icon,
  TrendingUpDownIcon,
} from "@hugeicons/core-free-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardShell } from "@/components/DashboardShell";
import { StreakCard } from "@/components/StreakCard";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { ProgressRing } from "@/components/motion/progress-ring";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { weightTone, type Tone } from "@/lib/progress-tone";
import { ApiError } from "@/lib/api";
import { computeAchievements, takeNewlyEarned, type Achievement, type AchievementTier } from "@/lib/achievements";
import { toast } from "@/lib/toast-store";
import {
  getProgress,
  getLeaderboard,
  type LeaderboardEntry,
  type LeaderboardResponse,
  type Progress,
  type ProgressRange,
} from "@/lib/tracking-api";

// recharts is heavy; load it only when this page renders a chart.
const TrendChart = dynamic(() => import("@/components/ui/trend-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-60 w-full rounded-3xl" />,
});

const RANGES: ProgressRange[] = ["7d", "30d", "90d"];
const LEADERBOARD_VISIBLE = 5;

const DANGER = "#FF3B30";

// ── page ─────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const [range, setRange] = useState<ProgressRange>("7d");

  const query = useQuery<Progress, ApiError>({
    queryKey: ["progress", range],
    queryFn: () => getProgress(range),
    retry: 0,
    // Keep the previous range's data on screen while the next one loads, so
    // switching 7d → 30d updates in place instead of flashing a skeleton.
    placeholderData: keepPreviousData,
  });

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-4xl flex-1 p-5 sm:p-6 lg:p-8">
        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft}>
            <p className="mb-1 text-[13px] font-bold uppercase tracking-widest text-accent">Insights · {range}</p>
            <h1 className="heading-heavy">Progress</h1>
          </motion.div>
          <div role="group" aria-label="Time range" className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                aria-pressed={r === range}
                className={cn(
                  "relative rounded-lg px-5 py-2 text-[12px] font-black uppercase tracking-widest transition-colors",
                  r === range ? "text-black" : "text-muted-foreground hover:text-white",
                )}
              >
                {r === range && (
                  <motion.div
                    layoutId="activeRange"
                    className="absolute inset-0 rounded-lg bg-white"
                    transition={spring.snappy}
                  />
                )}
                <span className="relative z-10">{r}</span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {query.isError ? (
            <motion.div key="error" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mt-10">
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
            </motion.div>
          ) : query.data ? (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              // Dim slightly while the next range is fetching behind the old data.
              animate={{ opacity: query.isPlaceholderData ? 0.55 : 1 }}
              transition={{ duration: 0.2 }}
              aria-busy={query.isPlaceholderData}
              className="mt-10"
            >
              <ProgressView data={query.data} range={range} />
            </motion.div>
          ) : (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-10">
              <LoadingSkeleton />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
}

// ── view ───────────────────────────────────────────────────────────────────

const TONE_CLASS: Record<Tone, string> = {
  good: "bg-accent/15 text-accent",
  bad: "bg-[#FF3B30]/15 text-[#FF3B30]",
  neutral: "bg-surface-2 text-muted-foreground",
};

function ProgressView({ data, range }: { data: Progress; range: ProgressRange }) {
  const series = data.weight_series.map((p) => ({ date: p.date, weight: p.weight_kg }));
  const weights = series.map((s) => s.weight);
  const lo = weights.length ? Math.floor(Math.min(...weights) - 1) : 0;
  const hi = weights.length ? Math.ceil(Math.max(...weights) + 1) : 1;
  const delta = weights.length >= 2 ? weights[weights.length - 1] - weights[0] : 0;
  const lastW = weights[weights.length - 1];
  const tone = weightTone(delta, data.projection);

  return (
    <Stagger onMount gap={0.09} className="space-y-4">
      <StaggerItem>
        <section className="surface-card">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="label-caps text-white">Weight Trend</h3>
              {weights.length > 0 && (
                <p className="mt-2 text-[40px] font-black leading-none tracking-tighter text-white">
                  <AnimatedNumber value={lastW} format={(n) => n.toFixed(1)} />
                  <span className="ml-1.5 text-lg font-bold text-muted-foreground">kg</span>
                </p>
              )}
            </div>
            {weights.length >= 2 && (
              <span
                className={cn("rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-widest", TONE_CLASS[tone])}
                title={
                  tone === "neutral"
                    ? "Change over this range"
                    : tone === "good"
                      ? "Moving toward your goal"
                      : "Moving away from your goal"
                }
              >
                {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)} kg · {data.range}
              </span>
            )}
          </div>

          {series.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[16px] font-bold text-white">No weigh-ins yet</p>
              <p className="mt-2 text-[13px] font-medium text-muted-foreground">Log your weight to see the trend.</p>
              <Link
                href="/dashboard/log"
                className="mt-5 inline-block rounded-full bg-accent px-6 py-3 text-[12px] font-black uppercase tracking-widest text-black transition-transform hover:scale-105 active:scale-95"
              >
                Log weight
              </Link>
            </div>
          ) : (
            <TrendChart series={series} lo={lo} hi={hi} />
          )}
        </section>
      </StaggerItem>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StaggerItem className="flex flex-col gap-4">
          <StatRing label="Adherence" value={data.adherence_rate * 100} hint={`Last ${data.range}`} />
          <StatRing
            label="Macros Hit"
            value={data.macro_hit_rate == null ? null : data.macro_hit_rate * 100}
            hint={data.macro_hit_rate == null ? "Log meals with macros to unlock" : `Last ${data.range}`}
            color="#64D2FF"
          />
        </StaggerItem>
        <StaggerItem>
          <StreakCard days={data.streak_days} className="h-full" />
        </StaggerItem>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StaggerItem>
          <ProjectionCard projection={data.projection} />
        </StaggerItem>
        {data.adaptive_tdee && (
          <StaggerItem>
            <AdaptiveTDEECard adaptive={data.adaptive_tdee} />
          </StaggerItem>
        )}
      </div>

      <StaggerItem>
        <AchievementsCard progress={data} range={range} />
      </StaggerItem>

      <StaggerItem>
        <LeaderboardCard />
      </StaggerItem>
    </Stagger>
  );
}

/** Ring + number for a 0–100 metric; `value === null` renders the "no data" state. */
function StatRing({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: number | null;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="surface-card flex items-center gap-5 p-5!">
      <ProgressRing
        pct={value ?? 0}
        size={80}
        stroke={10}
        color={color}
        label={value == null ? `${label}: no data yet` : `${label}: ${Math.round(value)}%`}
      >
        {value == null ? (
          <span className="text-lg font-black text-muted-foreground">—</span>
        ) : (
          <AnimatedNumber
            value={value}
            format={(n) => `${Math.round(n)}%`}
            className="text-[15px] font-black tabular-nums text-white"
          />
        )}
      </ProgressRing>
      <div className="min-w-0">
        <p className="label-caps text-white">{label}</p>
        {hint && <p className="mt-1 text-[12px] font-medium text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function ProjectionCard({ projection }: { projection: Progress["projection"] }) {
  let body: React.ReactNode;

  if (!projection.available) {
    body = (
      <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">
        {projection.reason ?? "Projection unlocks once you have a few weigh-ins."}
      </p>
    );
  } else if (projection.stalled) {
    body = (
      <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">
        Your weight is holding steady. If that&apos;s not the goal, nudge your intake.
      </p>
    );
  } else if (projection.moving_wrong_direction) {
    body = (
      <p className="text-[13px] font-medium leading-relaxed" style={{ color: DANGER }}>
        You&apos;re currently trending away from your goal weight.
      </p>
    );
  } else {
    const rate = projection.current_rate_kg_per_week ?? 0;
    const sign = rate >= 0 ? "+" : "";
    const target = projection.projected_target_date ? parseISO(projection.projected_target_date) : null;
    const days = target ? differenceInCalendarDays(target, new Date()) : null;
    body = (
      <div className="space-y-4">
        <p className="text-[14px] font-bold leading-relaxed text-white">
          At {sign}
          {rate} kg/wk, you&apos;ll hit your goal by{" "}
          <span className="text-accent">{target ? format(target, "d MMM yyyy") : projection.projected_target_date}</span>
          {days != null && days > 0 && (
            <span className="font-medium text-muted-foreground">
              {" "}
              (~{days >= 14 ? `${Math.round(days / 7)} weeks` : `${days} days`})
            </span>
          )}
          .
        </p>
        <p
          className={cn("text-[11px] font-black uppercase tracking-widest", projection.on_track ? "text-accent" : "")}
          style={projection.on_track ? undefined : { color: DANGER }}
        >
          {projection.on_track ? "On track" : "Off pace"}
        </p>
      </div>
    );
  }

  return (
    <section className="surface-card flex h-full min-h-45 flex-col">
      <div className="mb-4 flex items-center gap-2">
        <HugeiconsIcon icon={TrendingUpDownIcon} className="h-5 w-5 text-white" />
        <h3 className="label-caps text-white">Projection</h3>
      </div>
      <div className="flex flex-1 flex-col justify-end">{body}</div>
    </section>
  );
}

const CONFIDENCE_SEGMENTS = { low: 1, medium: 2, high: 3 } as const;

function AdaptiveTDEECard({ adaptive }: { adaptive: NonNullable<Progress["adaptive_tdee"]> }) {
  const filled = CONFIDENCE_SEGMENTS[adaptive.confidence] ?? 1;

  return (
    <section className="surface-card flex h-full min-h-45 flex-col">
      <div className="mb-4 flex items-center gap-2">
        <HugeiconsIcon icon={FireIcon} className="h-5 w-5 text-accent" />
        <h3 className="label-caps text-white">Adaptive TDEE</h3>
        {adaptive.available && (
          <span className="ml-auto rounded-lg bg-accent px-2 py-1 text-[10px] font-black uppercase tracking-widest text-black">
            Active
          </span>
        )}
      </div>

      {adaptive.available ? (
        <div className="flex flex-1 flex-col justify-end space-y-4">
          <div className="flex items-baseline gap-2">
            <AnimatedNumber value={adaptive.tdee} className="text-[40px] font-black tracking-tighter text-white" />
            <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">kcal / day</span>
          </div>
          <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
            Based on {adaptive.data_days} days of data.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex flex-1 gap-1.5" aria-hidden>
              {[1, 2, 3].map((i) => (
                <motion.span
                  key={i}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ ...spring.soft, delay: 0.5 + i * 0.1 }}
                  className={cn("h-1.5 flex-1 origin-left rounded-full", i <= filled ? "bg-white" : "bg-surface-2")}
                />
              ))}
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest text-white">
              {adaptive.confidence} confidence
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-end space-y-2">
          <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">
            {adaptive.reason ?? "Keep logging weight and meals to unlock."}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-surface-2" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Needs data</span>
          </div>
        </div>
      )}
    </section>
  );
}

// ── achievements ─────────────────────────────────────────────────────────────

const TIER_STYLE: Record<AchievementTier, { color: string; glow: string }> = {
  bronze: { color: "#CD7F32", glow: "rgba(205,127,50,0.35)" },
  silver: { color: "#C7C7CC", glow: "rgba(199,199,204,0.35)" },
  gold: { color: "#FFD60A", glow: "rgba(255,214,10,0.4)" },
  platinum: { color: "#B9F2FF", glow: "rgba(185,242,255,0.4)" },
};

/** Category is encoded in the id prefix — icon reflects what the badge is for. */
function achievementIcon(id: string) {
  if (id.startsWith("streak-")) return FireIcon;
  if (id.startsWith("adherence-")) return Target01Icon;
  if (id.startsWith("rank-")) return Award01Icon;
  return SparklesIcon;
}

function AchievementBadge({ achievement, delay }: { achievement: Achievement; delay: number }) {
  const style = TIER_STYLE[achievement.tier];
  const icon = achievementIcon(achievement.id);
  return (
    <motion.li
      initial={{ opacity: 0, scale: 0.9 }}
      // The animated target has to match earned state too — animating flatly
      // to opacity: 1 would win over an opacity-60 class (inline style beats a
      // class) and undo the dimming meant to mark a locked badge as locked.
      animate={{ opacity: achievement.earned ? 1 : 0.6, scale: 1 }}
      transition={{ ...spring.snappy, delay }}
      title={`${achievement.title} — ${achievement.description}${achievement.earned ? " (earned)" : " (locked)"}`}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-colors",
        achievement.earned ? "border-white/10 bg-surface-2" : "border-border bg-surface",
      )}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={
          achievement.earned
            ? { background: `${style.color}22`, color: style.color, boxShadow: `0 0 16px ${style.glow}` }
            : { background: "var(--surface-2)", color: "var(--muted-foreground)" }
        }
      >
        <HugeiconsIcon icon={achievement.earned ? icon : LockIcon} className="h-5 w-5" />
      </div>
      <p className={cn("text-[11px] font-bold leading-tight", achievement.earned ? "text-white" : "text-muted-foreground")}>
        {achievement.title}
      </p>
    </motion.li>
  );
}

function AchievementsCard({ progress, range }: { progress: Progress; range: ProgressRange }) {
  const leaderboardQuery = useLeaderboardQuery();
  // Achievements render fine before the leaderboard resolves (rank-based ones
  // just start locked); they don't block on it the way LeaderboardCard does.
  const achievements = computeAchievements(progress, range, leaderboardQuery.data?.user_rank ?? null);
  const earnedCount = achievements.filter((a) => a.earned).length;

  useEffect(() => {
    // Only run once the leaderboard has had a chance to resolve — otherwise a
    // rank-based badge would look "locked" here and "earned" a moment later,
    // and get wrongly counted as freshly earned on every page load.
    if (leaderboardQuery.isLoading) return;
    const fresh = takeNewlyEarned(achievements);
    for (const a of fresh) toast.success(`🏆 New achievement: ${a.title}`);
    // Deliberately excludes `achievements` (a new array every render) —
    // this must run once per underlying data change, not once per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderboardQuery.isLoading, progress.streak_days, progress.macro_hit_rate, leaderboardQuery.data?.user_rank?.rank]);

  return (
    <section className="surface-card">
      <div className="mb-6 flex items-center gap-2 border-b border-border pb-4">
        <HugeiconsIcon icon={Award01Icon} className="h-5 w-5 text-accent" />
        <h3 className="label-caps text-white">Achievements</h3>
        <span className="ml-auto text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {earnedCount} / {achievements.length} earned
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {achievements.map((a, i) => (
          <AchievementBadge key={a.id} achievement={a} delay={0.15 + i * 0.03} />
        ))}
      </ul>
    </section>
  );
}

// ── leaderboard ──────────────────────────────────────────────────────────────

const PODIUM = ["bg-[#FFD60A] text-black", "bg-[#C7C7CC] text-black", "bg-[#CD7F32] text-black"];

function LeaderboardRow({ entry, delay }: { entry: LeaderboardEntry; delay: number }) {
  const isUser = entry.is_you;
  return (
    <motion.li
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...spring.soft, delay }}
      className={cn(
        "flex items-center justify-between rounded-xl px-4 py-3",
        isUser ? "border-l-4 border-accent bg-surface-2" : "bg-surface",
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-black",
            PODIUM[entry.rank - 1] ?? (isUser ? "text-accent" : "text-muted-foreground"),
          )}
          aria-label={`Rank ${entry.rank}`}
        >
          {entry.rank}
        </span>
        <div className="min-w-0">
          <p className={cn("truncate text-[14px] font-bold", isUser ? "text-white" : "text-muted-foreground")}>
            {isUser ? "You" : entry.display_name}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground/70">
            {entry.meals_followed} meals · {entry.workouts_done} workouts
          </p>
        </div>
      </div>
      <span className={cn("text-[16px] font-black tracking-tight tabular-nums", isUser ? "text-white" : "text-muted-foreground")}>
        {entry.score}%
      </span>
    </motion.li>
  );
}

/** Shared by LeaderboardCard and AchievementsCard — one request, one cache entry. */
function useLeaderboardQuery() {
  return useQuery<LeaderboardResponse, ApiError>({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard(7),
    retry: 0,
  });
}

function LeaderboardCard() {
  const query = useLeaderboardQuery();

  if (query.isLoading) return <Skeleton className="h-48 w-full rounded-3xl" />;
  if (query.isError || !query.data) return null;

  const { entries, user_rank } = query.data;
  const top = entries.slice(0, LEADERBOARD_VISIBLE);
  // The API returns up to 20 ranks but we only show 5 — if the user is 6th or
  // lower, pin their own row underneath so they can still see where they stand.
  const userBelowFold = user_rank && !top.some((e) => e.rank === user_rank.rank) ? user_rank : null;

  return (
    <section className="surface-card">
      <div className="mb-6 flex items-center gap-2 border-b border-border pb-4">
        <HugeiconsIcon icon={FireIcon} className="h-5 w-5 text-accent" />
        <h3 className="label-caps text-white">Leaderboard</h3>
        <span className="ml-auto text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Top Adherence (7d)
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-[13px] font-medium text-muted-foreground">No data available yet.</p>
      ) : (
        <ol className="space-y-2">
          {top.map((entry, idx) => (
            <LeaderboardRow key={entry.rank} entry={entry} delay={0.2 + idx * 0.08} />
          ))}
          {userBelowFold && (
            <>
              <li aria-hidden className="py-1 text-center text-[13px] font-black tracking-[0.4em] text-muted-foreground/50">
                ···
              </li>
              <LeaderboardRow entry={userBelowFold} delay={0.2 + top.length * 0.08} />
            </>
          )}
        </ol>
      )}
    </section>
  );
}

// ── states ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading your progress">
      <Skeleton className="h-90 rounded-3xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
        <Skeleton className="h-60 rounded-3xl" />
      </div>
      <Skeleton className="h-44 rounded-3xl" />
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: ApiError | null; onRetry: () => void }) {
  return (
    <div className="surface-card mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#FF3B30]/10 text-[#FF3B30]">
        <HugeiconsIcon icon={Alert01Icon} className="h-8 w-8" />
      </div>
      <p className="mb-2 text-xl font-bold text-white">Couldn&apos;t load progress</p>
      <p className="mb-6 text-[14px] font-medium text-muted-foreground">{error?.detail ?? "Please try again."}</p>
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onRetry}
        className="rounded-full bg-accent px-6 py-3 text-[12px] font-black uppercase tracking-widest text-black"
      >
        Try again
      </motion.button>
    </div>
  );
}
