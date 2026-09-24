/**
 * Achievement badges, computed client-side from data the Progress page
 * already loads (its own progress query + the leaderboard query) — no new
 * endpoint. Pure functions so they're testable without React or a network.
 */

import { STREAK_MILESTONES } from "@/components/StreakCard";
import type { LeaderboardEntry, Progress, ProgressRange } from "./tracking-api";

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  tier: AchievementTier;
  earned: boolean;
  /**
   * Whether this badge is worth celebrating as "just earned" when it flips
   * from locked to earned. Range-relative badges (adherence for whichever
   * range is on screen) would "re-earn" every time the range is switched,
   * which isn't a real new achievement — those are excluded.
   */
  celebratable: boolean;
}

const TIER_FOR_STREAK: Record<(typeof STREAK_MILESTONES)[number], AchievementTier> = {
  3: "bronze",
  7: "bronze",
  14: "silver",
  30: "silver",
  60: "gold",
  100: "platinum",
};

function streakAchievements(streakDays: number): Achievement[] {
  return STREAK_MILESTONES.map((m) => ({
    id: `streak-${m}`,
    title: `${m}-Day Streak`,
    description: `Log a meal or workout ${m} days in a row.`,
    tier: TIER_FOR_STREAK[m],
    earned: streakDays >= m,
    celebratable: true,
  }));
}

const ADHERENCE_TIERS: { min: number; tier: AchievementTier; label: string }[] = [
  { min: 0.5, tier: "bronze", label: "Consistent" },
  { min: 0.75, tier: "silver", label: "Disciplined" },
  { min: 0.9, tier: "gold", label: "Elite" },
];

function adherenceAchievements(adherenceRate: number, range: ProgressRange): Achievement[] {
  const rangeLabel = range === "7d" ? "week" : range === "30d" ? "month" : "90 days";
  return ADHERENCE_TIERS.map((t) => ({
    id: `adherence-${range}-${t.tier}`,
    title: t.label,
    description: `Hit ${Math.round(t.min * 100)}%+ plan adherence this ${rangeLabel}.`,
    tier: t.tier,
    earned: adherenceRate >= t.min,
    // Tied to whichever range is on screen, so it isn't a stable "new" event.
    celebratable: false,
  }));
}

function macroAchievement(macroHitRate: number | null): Achievement | null {
  if (macroHitRate == null) return null;
  return {
    id: "macro-mastery",
    title: "Macro Mastery",
    description: "Hit your macro targets on 80%+ of logged days.",
    tier: "gold",
    earned: macroHitRate >= 0.8,
    celebratable: true,
  };
}

const RANK_TIERS: { max: number; tier: AchievementTier; label: string }[] = [
  { max: 10, tier: "bronze", label: "Top 10 in College" },
  { max: 3, tier: "gold", label: "Top 3 in College" },
  { max: 1, tier: "platinum", label: "#1 in College" },
];

function leaderboardAchievements(userRank: LeaderboardEntry | null): Achievement[] {
  return RANK_TIERS.map((t) => ({
    id: `rank-${t.max}`,
    title: t.label,
    description: `Rank in the top ${t.max === 1 ? "spot" : t.max} of your college's weekly leaderboard.`,
    tier: t.tier,
    earned: !!userRank && userRank.rank <= t.max,
    celebratable: true,
  }));
}

export function computeAchievements(
  progress: Progress,
  range: ProgressRange,
  userRank: LeaderboardEntry | null,
): Achievement[] {
  return [
    ...streakAchievements(progress.streak_days),
    ...adherenceAchievements(progress.adherence_rate, range),
    ...(macroAchievement(progress.macro_hit_rate) ? [macroAchievement(progress.macro_hit_rate)!] : []),
    ...leaderboardAchievements(userRank),
  ];
}

// ── "newly earned" tracking (localStorage; per-browser, best-effort) ────────

const SEEN_KEY = "messfit:achievements-seen:v1";

/** `null` means "never written before" — distinct from an empty-but-seeded set. */
function readRawSeen(): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch {
    // Storage unavailable (private mode, blocked). Treat as "not first run" so
    // we don't celebrate the same already-earned badges on every page load.
    return new Set();
  }
}

function writeSeen(ids: Set<string>): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable — celebrations just won't be remembered */
  }
}

/**
 * Diffs `earned` celebratable achievement ids against what's been seen
 * before, returns the newly-earned ones, and marks the full earned set as
 * seen. Call once per achievements computation (not on every render) — it
 * has the side effect of persisting.
 */
export function takeNewlyEarned(achievements: Achievement[]): Achievement[] {
  const raw = readRawSeen();
  // No record at all means this is the very first computation this browser has
  // ever done — everything already earned at that point was earned before we
  // started watching, not "just now", so nothing gets celebrated. Only seed.
  const firstRun = raw === null;
  const seen = raw ?? new Set<string>();
  const earned = achievements.filter((a) => a.earned);
  const fresh = firstRun ? [] : earned.filter((a) => a.celebratable && !seen.has(a.id));
  writeSeen(new Set([...seen, ...earned.map((a) => a.id)]));
  return fresh;
}
