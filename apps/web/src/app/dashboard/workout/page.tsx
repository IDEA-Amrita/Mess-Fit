"use client";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert01Icon, CheckmarkCircle01Icon, ArrowDown01Icon, Dumbbell01Icon, PlayCircle02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardShell } from "@/components/DashboardShell";
import { RestTimer } from "@/components/workout/RestTimer";
import { VideoModal } from "@/components/workout/VideoModal";
import { getTodayWorkout, logWorkout, type TodayWorkout, type WorkoutExercise } from "@/lib/workout-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

function SetRow({ total, done, onComplete }: { total: number; done: number; onComplete: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const isDone = i < done;
        const isNext = i === done;
        return (
          <motion.button
            key={i}
            whileTap={isNext ? { scale: 0.9 } : undefined}
            disabled={!isNext}
            onClick={onComplete}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-black transition-colors disabled:cursor-default",
              isDone ? "bg-accent text-black" : isNext ? "bg-surface-2 text-white hover:bg-border border-2 border-accent" : "bg-surface text-muted-foreground border border-border"
            )}
          >
            {isDone ? <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-5 w-5" strokeWidth={2} /> : i + 1}
          </motion.button>
        );
      })}
    </div>
  );
}

function ExerciseCard({ ex, done, onCompleteSet, onWatch }: { ex: WorkoutExercise; done: number; onCompleteSet: () => void; onWatch: () => void }) {
  const [open, setOpen] = useState(false);
  const allDone = done >= ex.sets;

  return (
    <motion.div layout className={cn("surface-card p-5 transition-opacity duration-500", allDone && "opacity-50 grayscale hover:grayscale-0 hover:opacity-100")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <motion.p layout="position" className="text-[16px] font-bold text-white leading-tight">
            {ex.name}
          </motion.p>
          <motion.div layout="position" className="mt-2 flex items-center gap-3">
            <span className="text-[12px] font-black text-muted-foreground uppercase tracking-widest">
              {ex.primary_muscle.replace(/_/g, " ")}
            </span>
            <span className="text-[12px] font-bold text-white">
              {ex.sets} × {ex.reps}
            </span>
          </motion.div>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-white transition-colors hover:bg-border"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4" />
        </button>
      </div>

      <motion.div layout="position" className="mt-6">
        <SetRow total={ex.sets} done={done} onComplete={onCompleteSet} />
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mt-6 space-y-4 border-t border-border pt-4 overflow-hidden" 
          >
            {ex.instruction_text && <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">{ex.instruction_text}</p>}
            {ex.common_mistakes.length > 0 && (
              <div>
                <p className="label-caps mb-2">Common mistakes</p>
                <ul className="space-y-2">
                  {ex.common_mistakes.map((m, i) => (
                    <li key={i} className="text-[13px] font-medium text-muted-foreground flex gap-2">
                      <span className="text-[#FF3B30] font-black">×</span> {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ex.youtube_video_id ? (
              <motion.button whileTap={{ scale: 0.98 }} onClick={onWatch} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 py-3 text-[13px] font-bold text-white transition-colors hover:bg-border">
                <HugeiconsIcon icon={PlayCircle02Icon} className="h-4 w-4 text-accent" /> Watch Demo
              </motion.button>
            ) : (
              <p className="text-[12px] font-medium text-muted-foreground">Demo video coming soon</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function WorkoutPage() {
  const router = useRouter();
  const [workout, setWorkout] = useState<TodayWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);

  const [setsDone, setSetsDone] = useState<Record<string, number>>({});
  const [rest, setRest] = useState<{ seconds: number; next?: string } | null>(null);
  const [video, setVideo] = useState<{ id: string; title: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<"done" | "skipped" | null>(null);

  const fetchWorkout = useCallback(async () => {
    setLoading(true); setError(null); setSaved(null); setSetsDone({});
    try { setWorkout(await getTodayWorkout()); }
    catch (err) { setError({ message: err instanceof ApiError ? err.detail : "Error", status: err instanceof ApiError ? err.status : undefined }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWorkout(); }, [fetchWorkout]);

  const totalSets = useMemo(() => workout?.exercises.reduce((s, e) => s + e.sets, 0) ?? 0, [workout]);
  const completedSets = useMemo(() => Object.values(setsDone).reduce((s, n) => s + n, 0), [setsDone]);
  const progressPct = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  function completeSet(ex: WorkoutExercise, idx: number) {
    if (!workout) return;
    setSetsDone((prev) => ({ ...prev, [ex.exercise_id]: (prev[ex.exercise_id] ?? 0) + 1 }));
    const isLastExercise = idx === workout.exercises.length - 1;
    const willCompleteExercise = (setsDone[ex.exercise_id] ?? 0) + 1 >= ex.sets;
    if (!(isLastExercise && willCompleteExercise)) {
      const next = willCompleteExercise && !isLastExercise ? workout.exercises[idx + 1]?.name : ex.name;
      setRest({ seconds: ex.rest_seconds, next });
    }
  }

  async function save(status: "done" | "skipped") {
    if (!workout) return;
    setSaving(true);
    try {
      await logWorkout({ date: todayIso(), template_id: workout.template_id, status: completedSets > 0 && completedSets < totalSets && status === "done" ? "partial" : status, exercises_done: workout.exercises.map((e) => ({ exercise_id: e.exercise_id, sets_done: setsDone[e.exercise_id] ?? 0, reps_done: [] })), skip_reason: status === "skipped" ? "Skipped from app" : null });
      setSaved(status);
    } catch { setError({ message: "Couldn't save your workout." }); }
    finally { setSaving(false); }
  }

  const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants: Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-4xl flex-1 p-5 sm:p-6 lg:p-8">
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-[13px] font-bold text-accent uppercase tracking-widest mb-1">
              {workout ? `${workout.day_name} · W${workout.week} D${workout.day}` : "Training"}
            </p>
            <h1 className="heading-heavy">Workout</h1>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
             <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={fetchWorkout}
                disabled={loading}
                className="flex items-center gap-2 rounded-full bg-surface-2 px-5 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-border disabled:opacity-50"
              >
                <HugeiconsIcon icon={RefreshIcon} className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </motion.button>
          </motion.div>
        </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-10 space-y-6">
             <Skeleton className="h-32 w-full rounded-[1.5rem] bg-surface" />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {[0,1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-[1.5rem] bg-surface" />)}
             </div>
          </motion.div>
        ) : error ? (
          <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-10">
             <div className="surface-card flex flex-col items-center justify-center py-24 text-center mx-auto max-w-md">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#FF3B30]/10 text-[#FF3B30]">
                  <HugeiconsIcon icon={Alert01Icon} size={32} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">{error.status === 409 ? "Onboarding Required" : "No Workout Today"}</h2>
                <p className="text-sm text-muted-foreground">{error.message}</p>
             </div>
          </motion.div>
        ) : workout ? (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 mt-8">
            
            {/* Hero Progress Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="surface-card flex flex-col justify-between min-h-[140px] relative overflow-hidden bg-surface-2">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[24px] font-black text-white tracking-tighter mb-1">{workout.template_name}</p>
                  <p className="text-[13px] font-bold text-muted-foreground">Current Block</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-white">{completedSets} <span className="text-lg text-muted-foreground">/ {totalSets}</span></p>
                  <p className="text-[11px] font-black uppercase tracking-widest text-accent">Sets Done</p>
                </div>
              </div>
              <div className="mt-8 h-2 w-full bg-surface rounded-full overflow-hidden relative z-10">
                <motion.div
                  className="h-full bg-accent rounded-full"
                  animate={{ width: `${progressPct}%` }}
                  transition={{ type: "spring", stiffness: 60, damping: 15 }}
                />
              </div>
            </motion.div>

            {/* Exercises Grid */}
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {workout.exercises.map((ex, idx) => (
                <motion.div key={ex.exercise_id} variants={itemVariants}>
                  <ExerciseCard ex={ex} done={setsDone[ex.exercise_id] ?? 0} onCompleteSet={() => completeSet(ex, idx)} onWatch={() => ex.youtube_video_id && setVideo({ id: ex.youtube_video_id, title: ex.name })} />
                </motion.div>
              ))}
            </motion.div>

            {/* Actions */}
            <AnimatePresence mode="popLayout">
              {saved ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="surface-card flex items-center justify-center gap-3 py-8">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-6 w-6 text-accent" strokeWidth={2} />
                  <p className="text-[16px] font-bold text-white">
                    {saved === "done" ? "Workout logged." : "Workout skipped."}
                  </p>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => save("skipped")}
                    disabled={saving}
                    className="w-full sm:w-auto rounded-full bg-surface px-8 py-4 text-[14px] font-bold text-white transition-colors hover:bg-surface-2 disabled:opacity-50"
                  >
                    Skip
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => save("done")}
                    disabled={saving}
                    className="w-full sm:w-auto rounded-full bg-accent px-10 py-4 text-[14px] font-black text-black transition-colors hover:bg-white disabled:opacity-50"
                  >
                    {saving ? "Saving" : completedSets >= totalSets ? "Finish Workout" : "Save Partial"}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {rest && <RestTimer seconds={rest.seconds} nextLabel={rest.next} onDone={() => setRest(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {video && <VideoModal videoId={video.id} title={video.title} onClose={() => setVideo(null)} />}
      </AnimatePresence>
      </div>
    </DashboardShell>
  );
}
