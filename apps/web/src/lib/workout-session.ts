import type { TodayWorkout } from "./workout-api";

/**
 * In-progress workout persistence.
 *
 * Sets are ticked off over an hour-long gym session, and mobile browsers
 * routinely evict background tabs (phone locks, user checks a message), so
 * keeping progress only in React state means one accidental reload wipes it.
 * We mirror it to localStorage, scoped to *today + this template* so a stale
 * session from yesterday (or a different plan) is never resurrected.
 *
 * Everything is wrapped in try/catch: localStorage can be unavailable (private
 * mode, blocked storage) and the page must still work without it.
 */

const KEY = "messfit:workout-session:v1";

export interface SessionState {
  /** exercise_id -> number of sets completed */
  setsDone: Record<string, number>;
  /** epoch ms of the first completed set, for the elapsed timer */
  startedAt: number | null;
}

interface Stored extends SessionState {
  date: string;
  templateId: string;
}

export const EMPTY_SESSION: SessionState = { setsDone: {}, startedAt: null };

export function saveSession(date: string, templateId: string, state: SessionState): void {
  try {
    const stored: Stored = { date, templateId, ...state };
    window.localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* storage unavailable — progress just won't survive a reload */
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Restore today's session for this workout, or null. Counts are clamped to each
 * exercise's set count and unknown exercises are dropped, so a template that
 * changed between saving and loading can't produce impossible state.
 */
export function loadSession(date: string, workout: TodayWorkout): SessionState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<Stored> | null;
    if (
      !stored ||
      stored.date !== date ||
      stored.templateId !== workout.template_id ||
      typeof stored.setsDone !== "object" ||
      stored.setsDone === null
    ) {
      clearSession(); // stale (another day / another plan)
      return null;
    }
    const setsDone: Record<string, number> = {};
    for (const ex of workout.exercises) {
      const n = Math.floor(Number(stored.setsDone[ex.exercise_id]));
      if (Number.isFinite(n) && n > 0) setsDone[ex.exercise_id] = Math.min(n, ex.sets);
    }
    return {
      setsDone,
      startedAt: typeof stored.startedAt === "number" ? stored.startedAt : null,
    };
  } catch {
    return null;
  }
}

export function totalCompleted(setsDone: Record<string, number>): number {
  return Object.values(setsDone).reduce((sum, n) => sum + n, 0);
}
