"use client";
import { HugeiconsIcon } from "@hugeicons/react";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Alert01Icon, CheckmarkCircle01Icon, ArrowDown01Icon, Dumbbell01Icon, PlayCircle02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
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
import { cn } from "@/lib/utils";

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
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-all disabled:cursor-default"
            style={
              isDone
                ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }
                : isNext
                  ? { background: "rgba(255,255,255,0.05)", color: "#e2e2e2", border: "1px solid rgba(245,158,11,0.5)", boxShadow: "0 0 10px rgba(245,158,11,0.2)" }
                  : { background: "rgba(255,255,255,0.02)", color: "#555", border: "1px solid rgba(255,255,255,0.05)" }
            }
          >
            {isDone ? <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-5 w-5" /> : i + 1}
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
    <div className={`glass-card p-5 ${allDone ? "opacity-60 grayscale hover:grayscale-0" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#f4f4f5", letterSpacing: "-0.01em", lineHeight: 1.3 }}>
            {ex.name}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(143,213,255,0.1)", color: "#8fd5ff" }}>
              {ex.primary_muscle.replace(/_/g, " ")}
            </span>
            <span className="text-[12px] font-bold text-muted-foreground">
              {ex.sets} × {ex.reps}
            </span>
          </div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle details"
          className="shrink-0 rounded-full p-2 transition-all hover:bg-white/5"
          style={{ color: "#a1a1aa", transform: open ? "rotate(180deg)" : "none" }}
        >
          <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5">
        <SetRow total={ex.sets} done={done} onComplete={onCompleteSet} />
      </div>

      {open && (
        <div className="mt-5 space-y-4 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {ex.instruction_text && (
            <p className="text-[13px] leading-relaxed" style={{ color: "#a1a1aa" }}>
              {ex.instruction_text}
            </p>
          )}
          {ex.common_mistakes.length > 0 && (
            <div>
              <p className="label-caps mb-2" style={{ color: "#71717a" }}>
                Common mistakes
              </p>
              <ul className="space-y-1.5">
                {ex.common_mistakes.map((m, i) => (
                  <li key={i} className="text-[13px] leading-relaxed flex gap-2" style={{ color: "#a1a1aa" }}>
                    <span style={{ color: "#ef4444" }}>×</span> {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ex.youtube_video_id ? (
            <button
              onClick={onWatch}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-bold transition-colors hover:bg-white/5"
              style={{ background: "rgba(255,255,255,0.03)", color: "#e2e2e2", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <HugeiconsIcon icon={PlayCircle02Icon} className="h-4 w-4" style={{ color: "#f59e0b" }} />
              Watch Demo
            </button>
          ) : (
            <p className="text-[12px] font-medium" style={{ color: "#52525b" }}>
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
      <div className="mf-rise mx-auto w-full max-w-5xl flex-1 space-y-8 p-5 sm:p-6 lg:p-8">
        
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.04em", color: "#f4f4f5" }}>
              Training
            </h1>
            {workout && (
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#a1a1aa", marginTop: "4px" }}>
                {workout.day_name} · Week {workout.week}, Day {workout.day}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
             <button
                onClick={fetchWorkout}
                disabled={loading}
                className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-40 hover:bg-white/5"
                style={{ background: "rgba(255,255,255,0.03)", color: "#f4f4f5", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <HugeiconsIcon icon={RefreshIcon} className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </button>
          </div>
        </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState error={error} />
      ) : workout ? (
        <div className="space-y-8">
          {/* Progress bar / Hero Card */}
          <div className="glass-card min-h-[160px] flex flex-col justify-end overflow-hidden group">
            <div className="absolute inset-0 z-0">
               <Image src="/images/workout_texture.png" alt="Workout background" fill sizes="(max-width: 768px) 100vw, 80vw" priority className="object-cover opacity-30 mix-blend-overlay transition-transform duration-[2s] group-hover:scale-105" />
               <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
               <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
            </div>
            
            <div className="relative z-10 p-6 lg:p-8">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p className="label-caps mb-1" style={{ color: "#8fd5ff" }}>Current Block</p>
                  <span style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
                    {workout.template_name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-right">
                   <div className="hidden sm:block">
                     <p className="label-caps mb-1 text-right" style={{ color: "#a1a1aa" }}>Sets done</p>
                     <p style={{ fontSize: "20px", fontWeight: 700, color: "#f4f4f5" }}>{completedSets} / {totalSets}</p>
                   </div>
                </div>
              </div>
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%`,
                    background: "linear-gradient(90deg, #d97706, #f59e0b)",
                    boxShadow: "0 0 10px rgba(245,158,11,0.5)"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Exercises */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              className="glass-card flex items-center justify-center gap-3 p-6"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-6 w-6" style={{ color: "#f59e0b" }} />
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#f4f4f5" }}>
                {saved === "done" ? "Workout logged. Incredible effort! 💪" : "Workout marked as skipped."}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => save("skipped")}
                disabled={saving}
                className="rounded-full px-8 py-4 text-sm font-bold transition-all disabled:opacity-50 hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#a1a1aa" }}
              >
                Skip Workout
              </button>
              <button
                onClick={() => save("done")}
                disabled={saving}
                className="rounded-full px-8 py-4 text-sm font-bold transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-95"
                style={{ background: "#f59e0b", color: "#1b1304", boxShadow: "0 0 20px rgba(245,158,11,0.2)" }}
              >
                {saving ? "Saving…" : completedSets >= totalSets ? "Finish Workout →" : "Save Partial Workout"}
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
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-card:not(.group):hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.18);
          box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.6);
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

// ── loading / error states ───────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-8 mt-6">
      <Skeleton className="h-40 rounded-3xl bg-white/5" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-40 rounded-3xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: { message: string; status?: number } }) {
  const isOnboarding = error.status === 409;
  return (
    <div className="glass-card mx-auto mt-12 flex max-w-md flex-col items-center justify-center gap-4 p-10 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-3xl"
        style={{ background: isOnboarding ? "rgba(245,158,11,0.1)" : "rgba(248,113,113,0.1)" }}
      >
        {isOnboarding ? (
          <HugeiconsIcon icon={Dumbbell01Icon} className="h-8 w-8" style={{ color: "#f59e0b" }} />
        ) : (
          <HugeiconsIcon icon={Alert01Icon} className="h-8 w-8" style={{ color: "#f87171" }} />
        )}
      </div>
      <div>
        <p style={{ fontSize: "20px", fontWeight: 700, color: "#f4f4f5" }}>
          {isOnboarding ? "Onboarding Required" : "Training Data Unavailable"}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "#a1a1aa" }}>
          {error.message}
        </p>
      </div>
      {isOnboarding && (
        <Link
          href="/onboarding/hostel"
          className="mt-4 rounded-full px-6 py-3 text-sm font-bold transition-all hover:scale-[1.02]"
          style={{ background: "#f59e0b", color: "#1b1304" }}
        >
          Complete Onboarding
        </Link>
      )}
    </div>
  );
}
