"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Dumbbell,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { DashboardShell } from "@/components/DashboardShell";
import { RestTimer } from "@/components/workout/RestTimer";
import { VideoModal } from "@/components/workout/VideoModal";
import {
  getTodayWorkout,
  logWorkout,
  type TodayWorkout,
  type WorkoutExercise,
} from "@/lib/workout-api";
import { ApiError } from "@/lib/api";

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local tz
}

// ── set checkboxes ─────────────────────────────────────────────────────────

function SetRow({
  total,
  done,
  onComplete,
}: {
  total: number;
  done: number;
  onComplete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const isDone = i < done;
        const isNext = i === done;
        return (
          <button
            key={i}
            disabled={!isNext}
            onClick={onComplete}
            aria-label={`Set ${i + 1}${isDone ? " done" : ""}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors disabled:cursor-default"
            style={
              isDone
                ? { background: "rgba(245,158,11,0.16)", color: "#f59e0b" }
                : isNext
                  ? { background: "rgba(255,255,255,0.06)", color: "#aaa", outline: "1px solid rgba(245,158,11,0.3)" }
                  : { background: "rgba(255,255,255,0.03)", color: "#3a3a3a" }
            }
          >
            {isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </button>
        );
      })}
    </div>
  );
}

// ── exercise card ──────────────────────────────────────────────────────────

function ExerciseCard({
  ex,
  done,
  onCompleteSet,
  onWatch,
}: {
  ex: WorkoutExercise;
  done: number;
  onCompleteSet: () => void;
  onWatch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const allDone = done >= ex.sets;

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: allDone ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${allDone ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.07)"}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-snug" style={{ color: "#e8e8e8" }}>
            {ex.name}
          </p>
          <p className="mt-0.5 text-xs capitalize" style={{ color: "#555" }}>
            {ex.primary_muscle.replace(/_/g, " ")} · {ex.sets} × {ex.reps}
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle details"
          className="shrink-0 rounded-lg p-1 transition-transform"
          style={{ color: "#666", transform: open ? "rotate(180deg)" : "none" }}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3">
        <SetRow total={ex.sets} done={done} onComplete={onCompleteSet} />
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {ex.instruction_text && (
            <p className="text-xs leading-relaxed" style={{ color: "#888" }}>
              {ex.instruction_text}
            </p>
          )}
          {ex.common_mistakes.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
                Common mistakes
              </p>
              <ul className="mt-1 space-y-0.5">
                {ex.common_mistakes.map((m, i) => (
                  <li key={i} className="text-xs leading-relaxed" style={{ color: "#666" }}>
                    • {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ex.youtube_video_id ? (
            <button
              onClick={onWatch}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Watch demo
            </button>
          ) : (
            <p className="text-xs" style={{ color: "#3a3a3a" }}>
              Demo video coming soon
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function WorkoutPage() {
  const router = useRouter();
  const [workout, setWorkout] = useState<TodayWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);

  // exercise_id → number of completed sets
  const [setsDone, setSetsDone] = useState<Record<string, number>>({});
  const [rest, setRest] = useState<{ seconds: number; next?: string } | null>(null);
  const [video, setVideo] = useState<{ id: string; title: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<"done" | "skipped" | null>(null);

  const fetchWorkout = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaved(null);
    setSetsDone({});
    try {
      const data = await getTodayWorkout();
      setWorkout(data);
    } catch (err) {
      if (err instanceof ApiError) setError({ message: err.detail, status: err.status });
      else setError({ message: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkout();
  }, [fetchWorkout]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  const totalSets = useMemo(
    () => workout?.exercises.reduce((s, e) => s + e.sets, 0) ?? 0,
    [workout],
  );
  const completedSets = useMemo(
    () => Object.values(setsDone).reduce((s, n) => s + n, 0),
    [setsDone],
  );

  function completeSet(ex: WorkoutExercise, idx: number) {
    if (!workout) return;
    setSetsDone((prev) => ({ ...prev, [ex.exercise_id]: (prev[ex.exercise_id] ?? 0) + 1 }));
    // Rest after every set except the last set of the final exercise.
    const isLastExercise = idx === workout.exercises.length - 1;
    const willCompleteExercise = (setsDone[ex.exercise_id] ?? 0) + 1 >= ex.sets;
    if (!(isLastExercise && willCompleteExercise)) {
      const next =
        willCompleteExercise && !isLastExercise
          ? workout.exercises[idx + 1]?.name
          : ex.name;
      setRest({ seconds: ex.rest_seconds, next });
    }
  }

  async function save(status: "done" | "skipped") {
    if (!workout) return;
    setSaving(true);
    try {
      await logWorkout({
        date: todayIso(),
        template_id: workout.template_id,
        status: completedSets > 0 && completedSets < totalSets && status === "done" ? "partial" : status,
        exercises_done: workout.exercises.map((e) => ({
          exercise_id: e.exercise_id,
          sets_done: setsDone[e.exercise_id] ?? 0,
          reps_done: [],
        })),
        skip_reason: status === "skipped" ? "Skipped from app" : null,
      });
      setSaved(status);
    } catch {
      setError({ message: "Couldn't save your workout. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell>
      <header
        className="flex h-16 shrink-0 items-center justify-between border-b px-6"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: "#f0f0f0" }}>
            Today&apos;s Workout
          </h1>
          {workout && (
            <p className="text-xs" style={{ color: "#444" }}>
              {workout.day_name} · Week {workout.week}, Day {workout.day}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchWorkout}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "#888" }}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium lg:hidden"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "#666" }}
          >
            Sign out
          </button>
        </div>
      </header>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState error={error} />
      ) : workout ? (
        <div className="flex-1 space-y-5 p-6">
          {/* Progress bar */}
          <div
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-semibold capitalize" style={{ color: "#c0c0c0" }}>
                {workout.template_name}
              </span>
              <span className="text-xs font-medium" style={{ color: "#888" }}>
                {completedSets} / {totalSets} sets
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%`,
                  background: "#f59e0b",
                }}
              />
            </div>
          </div>

          {/* Exercises */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workout.exercises.map((ex, idx) => (
              <ExerciseCard
                key={ex.exercise_id}
                ex={ex}
                done={setsDone[ex.exercise_id] ?? 0}
                onCompleteSet={() => completeSet(ex, idx)}
                onWatch={() =>
                  ex.youtube_video_id && setVideo({ id: ex.youtube_video_id, title: ex.name })
                }
              />
            ))}
          </div>

          {/* Actions */}
          {saved ? (
            <div
              className="flex items-center gap-2 rounded-2xl p-4"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)" }}
            >
              <CheckCircle2 className="h-5 w-5" style={{ color: "#f59e0b" }} />
              <p className="text-sm font-medium" style={{ color: "#e8e8e8" }}>
                {saved === "done" ? "Workout logged. Nice work! 💪" : "Marked as skipped."}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => save("done")}
                disabled={saving}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ background: "#f59e0b", color: "#1a1300" }}
              >
                {saving ? "Saving…" : completedSets >= totalSets ? "Finish workout" : "Mark as done"}
              </button>
              <button
                onClick={() => save("skipped")}
                disabled={saving}
                className="rounded-xl border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50"
                style={{ borderColor: "rgba(255,255,255,0.1)", color: "#666" }}
              >
                Skip
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Overlays */}
      {rest && (
        <RestTimer
          seconds={rest.seconds}
          nextLabel={rest.next}
          onDone={() => setRest(null)}
        />
      )}
      {video && (
        <VideoModal videoId={video.id} title={video.title} onClose={() => setVideo(null)} />
      )}
    </DashboardShell>
  );
}

// ── loading / error states ───────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5 p-6">
      <Skeleton className="h-16 rounded-2xl bg-white/5" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: { message: string; status?: number } }) {
  const isOnboarding = error.status === 409;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: isOnboarding ? "rgba(245,158,11,0.1)" : "rgba(248,113,113,0.1)" }}
      >
        {isOnboarding ? (
          <Dumbbell className="w-7 h-7" style={{ color: "#f59e0b" }} />
        ) : (
          <AlertCircle className="w-7 h-7" style={{ color: "#f87171" }} />
        )}
      </div>
      <div>
        <p className="font-semibold" style={{ color: "#d0d0d0" }}>
          {isOnboarding ? "Onboarding required" : "Couldn't load your workout"}
        </p>
        <p className="mt-1 max-w-xs text-sm leading-relaxed" style={{ color: "#555" }}>
          {error.message}
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
