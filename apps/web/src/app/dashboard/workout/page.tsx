"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert01Icon,
  ArrowDown01Icon,
  CheckmarkCircle01Icon,
  PlayCircle02Icon,
  RefreshIcon,
  Timer02Icon,
} from "@hugeicons/core-free-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardShell } from "@/components/DashboardShell";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { ProgressRing } from "@/components/motion/progress-ring";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { RestTimer } from "@/components/workout/RestTimer";
import { VideoModal } from "@/components/workout/VideoModal";
import { getTodayWorkout, logWorkout, type TodayWorkout, type WorkoutExercise, type WorkoutStatus } from "@/lib/workout-api";
import { getTodayLogs, todayIso } from "@/lib/tracking-api";
import {
  clearSession,
  EMPTY_SESSION,
  loadSession,
  saveSession,
  totalCompleted,
  type SessionState,
} from "@/lib/workout-session";
import { ApiError } from "@/lib/api";
import { toast } from "@/lib/toast-store";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

const WORKOUT_KEY = ["workout", "today"] as const;
const LOGS_KEY = ["logs", "today"] as const;

const STATUS_LABEL: Record<string, string> = { done: "Completed", partial: "Partial", skipped: "Skipped" };

// ── small pieces ─────────────────────────────────────────────────────────────

/** Ticks on its own so the whole page doesn't re-render every second. */
function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const text = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-bold tabular-nums text-muted-foreground">
      <HugeiconsIcon icon={Timer02Icon} size={14} />
      {text}
    </span>
  );
}

function SetRow({
  exName,
  total,
  done,
  locked,
  onComplete,
  onUndo,
}: {
  exName: string;
  total: number;
  done: number;
  locked: boolean;
  onComplete: () => void;
  onUndo: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const isDone = i < done;
        const isNext = i === done;
        // The most recent completed set doubles as "undo" for a mis-tap.
        const isUndo = isDone && i === done - 1;
        const interactive = !locked && (isNext || isUndo);
        return (
          <motion.button
            key={i}
            // No entrance animation on mount (restored sessions shouldn't replay it);
            // the pop below only fires when a set actually flips to done.
            initial={false}
            animate={{ scale: isDone ? [1, 1.25, 1] : 1 }}
            transition={{ duration: 0.3 }}
            whileTap={interactive ? { scale: 0.9 } : undefined}
            disabled={!interactive}
            onClick={isNext ? onComplete : onUndo}
            aria-label={
              isDone
                ? isUndo && !locked
                  ? `Set ${i + 1} of ${exName} done — tap to undo`
                  : `Set ${i + 1} of ${exName} done`
                : `Complete set ${i + 1} of ${exName}`
            }
            title={isUndo && !locked ? "Tap to undo" : undefined}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-black transition-colors disabled:cursor-default",
              isDone
                ? "bg-accent text-black"
                : isNext
                  ? "border-2 border-accent bg-surface-2 text-white hover:bg-border"
                  : "border border-border bg-surface text-muted-foreground",
            )}
          >
            {isDone ? <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-5 w-5" strokeWidth={2} /> : i + 1}
          </motion.button>
        );
      })}
    </div>
  );
}

function ExerciseCard({
  ex,
  done,
  current,
  locked,
  onCompleteSet,
  onUndoSet,
  onWatch,
}: {
  ex: WorkoutExercise;
  done: number;
  current: boolean;
  locked: boolean;
  onCompleteSet: () => void;
  onUndoSet: () => void;
  onWatch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const allDone = done >= ex.sets;

  return (
    <div
      className={cn(
        "surface-card h-full p-5! transition-[opacity,border-color,box-shadow] duration-500",
        current && !locked && "border-accent/60 shadow-[0_0_24px_rgba(204,255,0,0.08)]",
        allDone && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[16px] font-bold leading-tight text-white">{ex.name}</p>
            {allDone && <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} className="shrink-0 text-accent" />}
          </div>
          {/* Wraps as a unit: the badge drops to its own line instead of squeezing the muscle label. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="whitespace-nowrap text-[12px] font-black uppercase tracking-widest text-muted-foreground">
              {ex.primary_muscle.replace(/_/g, " ")}
            </span>
            <span className="whitespace-nowrap text-[12px] font-bold text-white">
              {ex.sets} × {ex.reps}
            </span>
            {current && !locked && (
              <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-black">
                Up next
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? `Hide details for ${ex.name}` : `Show details for ${ex.name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-white transition-colors hover:bg-border"
        >
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring.snappy} className="flex">
            <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4" />
          </motion.span>
        </button>
      </div>

      <div className="mt-6">
        <SetRow exName={ex.name} total={ex.sets} done={done} locked={locked} onComplete={onCompleteSet} onUndo={onUndoSet} />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="mt-6 space-y-4 overflow-hidden border-t border-border pt-4"
          >
            {ex.instruction_text && (
              <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">{ex.instruction_text}</p>
            )}
            {ex.common_mistakes.length > 0 && (
              <div>
                <p className="label-caps mb-2">Common mistakes</p>
                <ul className="space-y-2">
                  {ex.common_mistakes.map((m, i) => (
                    <li key={i} className="flex gap-2 text-[13px] font-medium text-muted-foreground">
                      <span className="font-black text-[#FF3B30]">×</span> {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ex.youtube_video_id ? (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={onWatch}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 py-3 text-[13px] font-bold text-white transition-colors hover:bg-border"
              >
                <HugeiconsIcon icon={PlayCircle02Icon} className="h-4 w-4 text-accent" /> Watch Demo
              </motion.button>
            ) : (
              <p className="text-[12px] font-medium text-muted-foreground">Demo video coming soon</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function WorkoutPage() {
  const qc = useQueryClient();
  const query = useQuery<TodayWorkout, ApiError>({ queryKey: WORKOUT_KEY, queryFn: getTodayWorkout, retry: 0 });
  const todayLogs = useQuery({ queryKey: LOGS_KEY, queryFn: getTodayLogs, retry: 1 });
  const workout = query.data;

  const [session, setSession] = useState<SessionState>(EMPTY_SESSION);
  // Handlers read the ref so two quick taps never act on a stale closure.
  const sessionRef = useRef<SessionState>(EMPTY_SESSION);
  const hydratedFor = useRef<string | null>(null);

  const [rest, setRest] = useState<{ seconds: number; next?: string } | null>(null);
  const [video, setVideo] = useState<{ id: string; title: string } | null>(null);
  const [saved, setSaved] = useState<WorkoutStatus | null>(null);

  // Restore an interrupted session once per (day, template). Persisting happens
  // in the handlers below rather than an effect, so this can never race with —
  // and clear — the data it is restoring.
  useEffect(() => {
    if (!workout) return;
    const key = `${todayIso()}:${workout.template_id}`;
    if (hydratedFor.current === key) return;
    hydratedFor.current = key;
    const restored = loadSession(todayIso(), workout);
    if (restored) {
      sessionRef.current = restored;
      setSession(restored);
    }
  }, [workout]);

  const totalSets = useMemo(() => workout?.exercises.reduce((s, e) => s + e.sets, 0) ?? 0, [workout]);
  const completedSets = totalCompleted(session.setsDone);
  const progressPct = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  const currentIdx = workout ? workout.exercises.findIndex((e) => (session.setsDone[e.exercise_id] ?? 0) < e.sets) : -1;
  const locked = saved !== null;
  const restored = completedSets > 0 && !saved;

  function commit(next: SessionState) {
    sessionRef.current = next;
    setSession(next);
    if (workout) saveSession(todayIso(), workout.template_id, next);
  }

  function completeSet(ex: WorkoutExercise, idx: number) {
    if (!workout || locked) return;
    const cur = sessionRef.current;
    const done = cur.setsDone[ex.exercise_id] ?? 0;
    if (done >= ex.sets) return;
    const after = done + 1;
    commit({ setsDone: { ...cur.setsDone, [ex.exercise_id]: after }, startedAt: cur.startedAt ?? Date.now() });

    const finishedExercise = after >= ex.sets;
    const isLastExercise = idx === workout.exercises.length - 1;
    if (!(isLastExercise && finishedExercise)) {
      setRest({ seconds: ex.rest_seconds, next: finishedExercise ? workout.exercises[idx + 1]?.name : ex.name });
    }
  }

  function undoSet(ex: WorkoutExercise) {
    if (locked) return;
    const cur = sessionRef.current;
    const done = cur.setsDone[ex.exercise_id] ?? 0;
    if (done <= 0) return;
    const setsDone = { ...cur.setsDone };
    if (done - 1 === 0) delete setsDone[ex.exercise_id];
    else setsDone[ex.exercise_id] = done - 1;
    commit({ ...cur, setsDone });
    setRest(null); // a rest for a set you just un-did makes no sense
  }

  const saveMutation = useMutation({
    mutationFn: (status: WorkoutStatus) => {
      const w = workout!;
      const cur = sessionRef.current;
      return logWorkout({
        date: todayIso(),
        template_id: w.template_id,
        status,
        exercises_done: w.exercises.map((e) => ({ exercise_id: e.exercise_id, sets_done: cur.setsDone[e.exercise_id] ?? 0, reps_done: [] })),
        skip_reason: status === "skipped" ? "Skipped from app" : null,
      });
    },
    onSuccess: (_data, status) => {
      clearSession();
      setSaved(status);
      // The Log page and dashboard read this; without it they stay stale for minutes.
      qc.invalidateQueries({ queryKey: LOGS_KEY });
    },
    // A failed save must never throw away the session the user just trained.
    onError: () => toast.error("Couldn't save — your sets are still here, try again"),
  });

  function finish() {
    saveMutation.mutate(completedSets >= totalSets ? "done" : "partial");
  }

  const loggedToday = todayLogs.data?.workout_status;

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-4xl flex-1 p-5 sm:p-6 lg:p-8">
        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft}>
            <p className="mb-1 text-[13px] font-bold uppercase tracking-widest text-accent">
              {workout ? `${workout.day_name} · W${workout.week} D${workout.day}` : "Training"}
            </p>
            <h1 className="heading-heavy">Workout</h1>
          </motion.div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            // Refetches the plan only — logged sets are session state and are kept.
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="flex items-center gap-2 self-start rounded-full bg-surface-2 px-5 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-border disabled:opacity-50 sm:self-auto"
          >
            <HugeiconsIcon icon={RefreshIcon} className={cn("h-4 w-4", query.isFetching && "animate-spin")} />
            Refresh
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {query.isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-10 space-y-6">
              <div aria-busy="true" aria-label="Loading your workout" className="space-y-6">
                <Skeleton className="h-36 w-full rounded-3xl" />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-48 rounded-3xl" />
                  ))}
                </div>
              </div>
            </motion.div>
          ) : query.isError ? (
            <motion.div key="error" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mt-10">
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
            </motion.div>
          ) : workout ? (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 space-y-6">
              {loggedToday && !saved && (
                <div className="flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-[13px] font-bold text-accent">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} />
                  Logged today: {STATUS_LABEL[loggedToday] ?? loggedToday}
                  <span className="font-medium text-muted-foreground"> — saving again will update it.</span>
                </div>
              )}
              {restored && (
                <p className="text-[12px] font-medium text-muted-foreground">Picked up where you left off.</p>
              )}

              {/* Hero */}
              <div className="surface-card flex items-center justify-between gap-6 bg-surface-2">
                <div className="min-w-0">
                  <p className="truncate text-[24px] font-black tracking-tighter text-white">{workout.template_name}</p>
                  <p className="mb-3 text-[13px] font-bold text-muted-foreground">Current Block</p>
                  {session.startedAt ? (
                    <Elapsed startedAt={session.startedAt} />
                  ) : (
                    <span className="text-[12px] font-medium text-muted-foreground">Timer starts with your first set</span>
                  )}
                </div>
                <ProgressRing
                  pct={progressPct}
                  size={104}
                  stroke={11}
                  label={`${completedSets} of ${totalSets} sets done`}
                >
                  <span className="text-2xl font-black tabular-nums text-white">
                    <AnimatedNumber value={completedSets} duration={0.5} />
                    <span className="text-sm text-muted-foreground">/{totalSets}</span>
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-accent">Sets</span>
                </ProgressRing>
              </div>

              {workout.exercises.length === 0 ? (
                <div className="surface-card py-12 text-center text-[14px] font-medium text-muted-foreground">
                  No exercises are loaded for today&apos;s session yet.
                </div>
              ) : (
                <Stagger onMount gap={0.08} className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {workout.exercises.map((ex, idx) => (
                    <StaggerItem key={ex.exercise_id} className="h-full">
                      <ExerciseCard
                        ex={ex}
                        done={session.setsDone[ex.exercise_id] ?? 0}
                        current={idx === currentIdx}
                        locked={locked}
                        onCompleteSet={() => completeSet(ex, idx)}
                        onUndoSet={() => undoSet(ex)}
                        onWatch={() => ex.youtube_video_id && setVideo({ id: ex.youtube_video_id, title: ex.name })}
                      />
                    </StaggerItem>
                  ))}
                </Stagger>
              )}

              <AnimatePresence mode="wait" initial={false}>
                {saved ? (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={spring.soft}
                    className="surface-card flex flex-col items-center justify-center gap-2 py-8"
                  >
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-8 w-8 text-accent" strokeWidth={2} />
                    <p className="text-[16px] font-bold text-white">
                      {saved === "skipped" ? "Workout skipped." : saved === "partial" ? "Partial workout logged." : "Workout logged. Nice work."}
                    </p>
                    {saved !== "skipped" && (
                      <p className="text-[13px] font-medium text-muted-foreground">
                        {completedSets} of {totalSets} sets
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="actions"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row"
                  >
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => saveMutation.mutate("skipped")}
                      disabled={saveMutation.isPending}
                      className="w-full rounded-full bg-surface px-8 py-4 text-[14px] font-bold text-white transition-colors hover:bg-surface-2 disabled:opacity-50 sm:w-auto"
                    >
                      Skip
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={finish}
                      // Nothing to save until at least one set is done — use Skip instead.
                      disabled={saveMutation.isPending || completedSets === 0}
                      className="w-full rounded-full bg-accent px-10 py-4 text-[14px] font-black text-black transition-colors hover:bg-white disabled:opacity-40 sm:w-auto"
                    >
                      {saveMutation.isPending ? "Saving…" : completedSets >= totalSets && totalSets > 0 ? "Finish Workout" : "Save Partial"}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>{rest && <RestTimer seconds={rest.seconds} nextLabel={rest.next} onDone={() => setRest(null)} />}</AnimatePresence>
        <AnimatePresence>
          {video && <VideoModal videoId={video.id} title={video.title} onClose={() => setVideo(null)} />}
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
}

function ErrorState({ error, onRetry }: { error: ApiError | null; onRetry: () => void }) {
  // 409 = profile/hostel not set up (or the template isn't seeded); the server
  // message says which. Everything else is a plain load failure.
  const setupNeeded = error?.status === 409;
  const needsOnboarding = setupNeeded && /onboarding/i.test(error?.detail ?? "");
  return (
    <div className="surface-card mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#FF3B30]/10 text-[#FF3B30]">
        <HugeiconsIcon icon={Alert01Icon} size={32} />
      </div>
      <h2 className="mb-2 text-xl font-bold text-white">{setupNeeded ? "Finish setup first" : "Couldn't load your workout"}</h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{error?.detail ?? "Please try again."}</p>
      {needsOnboarding ? (
        <Link
          href="/onboarding/hostel"
          className="rounded-full bg-accent px-6 py-3 text-[12px] font-black uppercase tracking-widest text-black"
        >
          Set up profile
        </Link>
      ) : (
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onRetry}
          className="rounded-full bg-accent px-6 py-3 text-[12px] font-black uppercase tracking-widest text-black"
        >
          Try again
        </motion.button>
      )}
    </div>
  );
}
