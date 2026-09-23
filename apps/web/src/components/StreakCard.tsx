"use client";

import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { FireIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { AnimatedNumber } from "@/components/motion/animated-number";

/** Streak lengths (days) worth celebrating. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;

/** The next milestone above `days`, or null once every one is cleared. */
export function nextMilestone(days: number): number | null {
  return STREAK_MILESTONES.find((m) => m > days) ?? null;
}

/**
 * Consecutive-day logging streak with a milestone track.
 *
 * Streaks are the strongest retention mechanic in habit apps, but they punish
 * a missed day harshly — so the copy for a zero streak is encouraging, not
 * a scolding "you lost it".
 */
export function StreakCard({
  days,
  loading,
  className,
}: {
  days: number | undefined;
  loading?: boolean;
  className?: string;
}) {
  const value = days ?? 0;
  const next = nextMilestone(value);
  const prev = [...STREAK_MILESTONES].reverse().find((m) => m <= value) ?? 0;
  const pctToNext = next ? ((value - prev) / (next - prev)) * 100 : 100;

  return (
    <div className={cn("surface-card flex flex-col justify-between p-5", className)}>
      <div className="flex items-center justify-between">
        <span className="label-caps">Streak</span>
        <motion.span
          animate={value > 0 ? { scale: [1, 1.18, 1] } : undefined}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4 }}
          className="inline-flex"
        >
          <HugeiconsIcon
            icon={FireIcon}
            size={22}
            className={value > 0 ? "text-[#FF9F0A] drop-shadow-[0_0_8px_rgba(255,159,10,0.6)]" : "text-muted-foreground"}
          />
        </motion.span>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="h-9 w-16 animate-pulse rounded-lg bg-surface-2" />
        ) : (
          <div className="flex items-baseline gap-1.5">
            <AnimatedNumber value={value} className="text-4xl font-black tabular-nums text-white" />
            <span className="text-sm font-bold text-muted-foreground">{value === 1 ? "day" : "days"}</span>
          </div>
        )}
        <p className="mt-1 text-[12px] font-medium text-muted-foreground">
          {loading
            ? " "
            : value === 0
              ? "Log a meal today to start a streak."
              : next
                ? `${next - value} more ${next - value === 1 ? "day" : "days"} to the ${next}-day badge.`
                : "Every milestone cleared. Legend."}
        </p>
      </div>

      {/* Progress to next milestone */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${loading ? 0 : pctToNext}%` }}
          transition={{ ...spring.soft, delay: 0.4 }}
          className="h-full rounded-full bg-gradient-to-r from-[#FF9F0A] to-accent"
        />
      </div>

      {/* Milestone badges */}
      <ul className="mt-3 flex gap-1.5" aria-label="Streak milestones">
        {STREAK_MILESTONES.map((m) => {
          const earned = value >= m;
          return (
            <li
              key={m}
              title={`${m}-day streak${earned ? " — earned" : ""}`}
              className={cn(
                "flex h-7 flex-1 items-center justify-center rounded-lg text-[10px] font-black transition-colors",
                earned ? "bg-accent text-black" : "bg-surface-2 text-muted-foreground/60",
              )}
            >
              {m}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
