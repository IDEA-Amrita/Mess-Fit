"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlateIcon,
  Dumbbell01Icon,
  AiChat01Icon,
  Analytics01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { motion } from "framer-motion";
import { useUser } from "@/hooks/use-user";
import { DashboardShell } from "@/components/DashboardShell";
import { StreakCard } from "@/components/StreakCard";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { ProgressRing } from "@/components/motion/progress-ring";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { getProgress, getTodayLogs } from "@/lib/tracking-api";
import { optimizeToday, type OptimizationResult } from "@/lib/optimizer-api";
import { item } from "@/lib/motion";

/** "Good morning" / "Good afternoon" / "Good evening" from the local hour. */
function greeting(hour = new Date().getHours()): string {
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const MACROS = [
  { key: "protein_g", label: "Protein", color: "var(--accent)" },
  { key: "carbs_g", label: "Carbs", color: "#64D2FF" },
  { key: "fats_g", label: "Fats", color: "#FF9F0A" },
] as const;

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

  // Same query key + range the Progress screen uses, so the cache is shared.
  const progress = useQuery({
    queryKey: ["progress", "7d"],
    queryFn: () => getProgress("7d"),
    retry: 1,
  });

  const plannedKcal = plate.data?.daily_totals?.kcal;
  const userTargets = user?.user_metadata?.targets;
  const targetKcal = plate.data?.daily_targets?.kcal ?? userTargets?.daily_kcal ?? 2500;
  const mealsLogged = todayLogs.data?.meals?.length ?? 0;
  const calPct = plannedKcal ? (plannedKcal / targetKcal) * 100 : 0;

  const firstName = displayName?.split(" ")[0] ?? "Athlete";
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-4xl flex-1 p-5 sm:p-6 lg:p-8">
        {/* ── Greeting ── */}
        <motion.div variants={item} initial="hidden" animate="show" className="mb-10 mt-4">
          <p className="mb-1 text-[13px] font-bold uppercase tracking-widest text-accent">{today}</p>
          <h1 className="heading-heavy">
            {greeting()}, {firstName}.
          </h1>
        </motion.div>

        <Stagger onMount gap={0.09} className="flex flex-col gap-4">
          {/* HERO: calorie ring + macro rings */}
          <StaggerItem>
            <SpotlightCard className="surface-card-hover">
              <Link href="/dashboard/plate" className="group flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 flex-col justify-center">
                  <div className="mb-2 flex items-center gap-2">
                    <HugeiconsIcon icon={PlateIcon} size={18} className="text-accent" />
                    <span className="label-caps text-accent">Nutrition Plan</span>
                  </div>

                  {plate.isLoading ? (
                    <div className="mb-2 h-8 w-40 animate-pulse rounded-lg bg-surface-2" />
                  ) : (
                    <p className="mb-1 text-3xl font-black tracking-tight text-white">
                      {plannedKcal != null ? (
                        <>
                          <AnimatedNumber value={plannedKcal} /> <span className="text-lg font-bold text-muted-foreground">kcal</span>
                        </>
                      ) : (
                        "Plan not generated"
                      )}
                    </p>
                  )}
                  <p className="text-sm font-medium text-muted-foreground">
                    {plannedKcal != null
                      ? `of your ${Math.round(targetKcal).toLocaleString()} kcal goal is planned today.`
                      : "Generate your plate to hit your macros."}
                  </p>

                  {/* Macro mini-bars */}
                  {plate.data && (
                    <div className="mt-6 grid grid-cols-3 gap-4">
                      {MACROS.map((m) => {
                        const got = plate.data?.daily_totals?.[m.key] ?? 0;
                        const goal = plate.data?.daily_targets?.[m.key] ?? 0;
                        const pct = goal ? Math.min((got / goal) * 100, 100) : 0;
                        return (
                          <div key={m.key}>
                            <div className="mb-1.5 flex items-baseline justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{m.label}</span>
                              <span className="text-[12px] font-black tabular-nums text-white">{Math.round(got)}g</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                className="h-full rounded-full"
                                style={{ background: m.color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-6 flex items-center gap-2 text-[13px] font-bold text-white transition-colors group-hover:text-accent">
                    View full breakdown{" "}
                    <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </div>

                <ProgressRing
                  pct={calPct}
                  size={168}
                  label={`${Math.round(calPct)}% of your calorie goal is planned`}
                  className="self-center"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Goal</span>
                  <span className="text-xl font-black tabular-nums text-white">{Math.round(targetKcal).toLocaleString()}</span>
                </ProgressRing>
              </Link>
            </SpotlightCard>
          </StaggerItem>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Streak (real data from /logs/progress) */}
            <StaggerItem>
              <StreakCard days={progress.data?.streak_days} loading={progress.isLoading} className="h-full" />
            </StaggerItem>

            <StaggerItem className="grid grid-cols-2 gap-4">
              <div className="surface-card flex flex-col justify-between p-5">
                <span className="label-caps">Meals today</span>
                <div className="mt-4">
                  <AnimatedNumber value={mealsLogged} className="text-4xl font-black text-white" />
                  <span className="ml-1 text-sm font-bold text-muted-foreground">/ 4</span>
                </div>
                <div className="mt-3 flex gap-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <motion.span
                      key={i}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.5 + i * 0.08 }}
                      className={`h-1.5 flex-1 origin-left rounded-full ${i < mealsLogged ? "bg-accent" : "bg-surface-2"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="surface-card flex flex-col justify-between p-5">
                <span className="label-caps">Adherence</span>
                <div className="mt-4">
                  {progress.data ? (
                    <AnimatedNumber
                      value={progress.data.adherence_rate * 100}
                      format={(n) => `${Math.round(n)}%`}
                      className="text-4xl font-black text-white"
                    />
                  ) : (
                    <span className="text-4xl font-black text-muted-foreground">—</span>
                  )}
                </div>
                <p className="mt-3 text-[11px] font-medium text-muted-foreground">Last 7 days</p>
              </div>
            </StaggerItem>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <QuickLink href="/dashboard/workout" icon={Dumbbell01Icon} title="Today's Block" sub="Log sets & progressive overload" />
            <QuickLink href="/dashboard/chat" icon={AiChat01Icon} title="Coach Chat" sub="Ask nutrition & fitness questions" />
            <QuickLink href="/dashboard/progress" icon={Analytics01Icon} title="Data & Progress" sub="Weight trends & adaptive TDEE" />
          </div>
        </Stagger>
      </div>
    </DashboardShell>
  );
}

function QuickLink({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: typeof PlateIcon;
  title: string;
  sub: string;
}) {
  return (
    <StaggerItem>
      <SpotlightCard className="surface-card-hover p-0!">
        <Link href={href} className="group flex items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-white transition-colors group-hover:bg-accent group-hover:text-black">
              <HugeiconsIcon icon={icon} size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-white">{title}</p>
              <p className="truncate text-[12px] font-medium text-muted-foreground">{sub}</p>
            </div>
          </div>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={18}
            className="shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-white"
          />
        </Link>
      </SpotlightCard>
    </StaggerItem>
  );
}
