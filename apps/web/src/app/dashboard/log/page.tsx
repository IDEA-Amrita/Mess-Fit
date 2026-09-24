"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick01Icon,
  PencilEdit01Icon,
  NextIcon,
  Dumbbell01Icon,
  WeightScale01Icon,
  SmileIcon,
  Restaurant01Icon,
  Camera01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardShell } from "@/components/DashboardShell";
import { ProgressRing } from "@/components/motion/progress-ring";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { track } from "@/lib/analytics";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { optimizeToday, type OptimizationResult, type PlateItem } from "@/lib/optimizer-api";
import {
  getTodayLogs,
  logMeal,
  logMealPhoto,
  logSubjective,
  logWeight,
  todayIso,
  type MealLogOut,
  type MealStatus,
  type MealType,
  type TodayLogs,
} from "@/lib/tracking-api";
import {
  getTodayWorkout,
  logWorkout,
  type TodayWorkout,
  type WorkoutStatus,
} from "@/lib/workout-api";

const TODAY_KEY = ["logs", "today"] as const;
const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "snack", "dinner"];

type Tab = "meal" | "weight" | "workout" | "mood";
type Macros = { kcal: number; protein_g: number; carbs_g: number; fats_g: number };

const TABS: { id: Tab; label: string; icon: typeof Tick01Icon }[] = [
  { id: "meal", label: "Meal", icon: Restaurant01Icon },
  { id: "weight", label: "Weight", icon: WeightScale01Icon },
  { id: "workout", label: "Workout", icon: Dumbbell01Icon },
  { id: "mood", label: "Mood", icon: SmileIcon },
];

/** Shared look for "selected option" pills (meal status, workout status). */
const ACTIVE_PILL = "border border-accent/30 bg-accent/15";

// ── check-in progress (derived from data we already fetch) ───────────────────

type Step = { id: Tab; label: string; /** 0–1 */ fraction: number; badge?: string };

function checkinSteps(today?: TodayLogs): Step[] {
  const meals = new Set(today?.meals.map((m) => m.meal_type)).size;
  const s = today?.subjective;
  const moodLogged = s != null && (s.energy != null || s.hunger != null || s.mood != null);
  return [
    { id: "meal", label: "Meals", fraction: meals / MEAL_ORDER.length, badge: `${meals}/${MEAL_ORDER.length}` },
    { id: "weight", label: "Weight", fraction: today?.weight ? 1 : 0 },
    { id: "workout", label: "Workout", fraction: today?.workout_status ? 1 : 0 },
    { id: "mood", label: "Mood", fraction: moodLogged ? 1 : 0 },
  ];
}

function CheckinSummary({ steps, loading }: { steps: Step[]; loading: boolean }) {
  const done = steps.filter((s) => s.fraction === 1).length;
  const pct = (steps.reduce((sum, s) => sum + s.fraction, 0) / steps.length) * 100;
  const complete = done === steps.length;

  return (
    <motion.div
      animate={{ boxShadow: complete ? "0 0 0 1px var(--accent), 0 0 32px rgba(204,255,0,0.18)" : "0 0 0 0 transparent" }}
      transition={{ duration: 0.6 }}
      className="surface-card flex items-center gap-5 p-5!"
    >
      <ProgressRing pct={loading ? 0 : pct} size={72} stroke={10} delay={0.1} label={`${done} of ${steps.length} check-ins done`}>
        <span className="text-lg font-black tabular-nums text-white">
          <AnimatedNumber value={loading ? 0 : done} />
          <span className="text-[11px] text-muted-foreground">/{steps.length}</span>
        </span>
      </ProgressRing>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-white">{complete ? "All logged — great work." : "Today's check-in"}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {steps.map((s) => (
            <span
              key={s.id}
              className={cn(
                "flex items-center gap-1 text-[12px] font-bold",
                s.fraction === 1 ? "text-accent" : "text-muted-foreground",
              )}
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} className={s.fraction === 1 ? "" : "opacity-30"} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function LogPage() {
  const [tab, setTab] = useState<Tab>("meal");
  const today = useQuery({ queryKey: TODAY_KEY, queryFn: getTodayLogs });
  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const steps = checkinSteps(today.data);

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-5 sm:p-6 lg:p-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft} className="mt-4">
          <p className="mb-1 text-[13px] font-bold uppercase tracking-widest text-accent">{dateStr}</p>
          <h1 className="heading-heavy">Daily Log</h1>
        </motion.div>

        <CheckinSummary steps={steps} loading={today.isLoading} />

        {/* Tab bar — the active pill glides between tabs */}
        <div role="tablist" aria-label="Log category" className="surface-card flex gap-1 rounded-2xl p-1!">
          {TABS.map((t) => {
            const step = steps.find((s) => s.id === t.id)!;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                aria-label={t.label}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold transition-colors",
                  active ? "text-accent" : "text-muted-foreground hover:text-white",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="log-tab-pill"
                    transition={spring.snappy}
                    className={cn("absolute inset-0 rounded-xl", ACTIVE_PILL)}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <HugeiconsIcon icon={t.icon} className="h-4 w-4" />
                  <span className="hidden text-[11px] uppercase tracking-wider sm:inline">{t.label}</span>
                  {step.fraction === 1 ? (
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} className="text-accent" />
                  ) : step.badge && step.fraction > 0 ? (
                    <span className="text-[10px] font-black tabular-nums text-muted-foreground">{step.badge}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            role="tabpanel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "meal" && <MealTab today={today.data} />}
            {tab === "weight" && <WeightTab today={today.data} loading={today.isLoading} />}
            {tab === "workout" && <WorkoutTab today={today.data} />}
            {tab === "mood" && <MoodTab today={today.data} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
}

// ── shared bits ──────────────────────────────────────────────────────────────

/** Row of mutually-exclusive options with a sliding highlight. `group` must be unique per row. */
function OptionRow<T extends string>({
  group,
  options,
  value,
  onSelect,
  className,
  alwaysLabel,
}: {
  group: string;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T | null | undefined;
  onSelect: (v: T) => void;
  className?: string;
  /** Show text labels on mobile too (default: icon-only below `sm`). */
  alwaysLabel?: boolean;
}) {
  return (
    <div className={cn("flex gap-2", className)}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <motion.button
            key={o.value}
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelect(o.value)}
            aria-pressed={active}
            aria-label={o.label}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent bg-white/3 py-3 text-[12px] font-bold transition-colors",
              active ? "text-accent" : "text-muted-foreground hover:text-white",
            )}
          >
            {active && (
              <motion.span
                layoutId={`opt-${group}`}
                transition={spring.snappy}
                className={cn("absolute inset-0 rounded-xl", ACTIVE_PILL)}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {o.icon}
              <span className={cn("text-[10px] uppercase tracking-wider", !alwaysLabel && "hidden sm:inline")}>{o.label}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Save button that briefly confirms with "Saved" after a successful mutation. */
function SaveButton({
  pending,
  saved,
  disabled,
  idle,
  onClick,
  className,
}: {
  pending: boolean;
  saved: boolean;
  disabled?: boolean;
  idle: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={pending || disabled}
      className={cn(
        "w-full rounded-full bg-accent py-4 text-[14px] font-bold text-black shadow-[0_0_20px_rgba(204,255,0,0.2)] transition-opacity disabled:opacity-40",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={pending ? "pending" : saved ? "saved" : "idle"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.12 }}
          className="inline-flex items-center gap-2"
        >
          {saved && !pending && <HugeiconsIcon icon={Tick01Icon} size={18} strokeWidth={3} />}
          {pending ? "Saving…" : saved ? "Saved" : idle}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

/** True for ~2s after `flag` flips on — drives the "Saved" confirmation. */
function useFlash(flag: boolean, ms = 2000) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!flag) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [flag, ms]);
  return on;
}

// ── meal tab ───────────────────────────────────────────────────────────────────

function slotMacros(items: PlateItem[]): Macros {
  return items.reduce<Macros>(
    (acc, d) => ({
      kcal: acc.kcal + d.kcal,
      protein_g: acc.protein_g + d.protein_g,
      carbs_g: acc.carbs_g + d.carbs_g,
      fats_g: acc.fats_g + d.fats_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
  );
}

function MealTab({ today }: { today?: TodayLogs }) {
  const qc = useQueryClient();
  const plate = useQuery<OptimizationResult>({
    queryKey: ["plate", "today"],
    queryFn: optimizeToday,
    retry: 0,
    staleTime: 0,
  });

  const rowByMeal = useMemo(() => {
    const map: Partial<Record<MealType, MealLogOut>> = {};
    today?.meals.forEach((m) => (map[m.meal_type] = m));
    return map;
  }, [today]);

  const mutation = useMutation({
    mutationFn: logMeal,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: TODAY_KEY });
      const prev = qc.getQueryData<TodayLogs>(TODAY_KEY);
      qc.setQueryData<TodayLogs>(TODAY_KEY, (old) => {
        if (!old) return old;
        const meals = old.meals.filter((m) => m.meal_type !== vars.meal_type);
        meals.push({
          id: `optimistic-${vars.meal_type}`,
          date: vars.date,
          meal_type: vars.meal_type,
          status: vars.status,
          notes: vars.notes ?? null,
          kcal: vars.kcal ?? null,
          protein_g: vars.protein_g ?? null,
          carbs_g: vars.carbs_g ?? null,
          fats_g: vars.fats_g ?? null,
        });
        return { ...old, meals };
      });
      return { prev };
    },
    onSuccess: (_data, vars) => {
      const label = vars.meal_type.charAt(0).toUpperCase() + vars.meal_type.slice(1);
      toast.success(`${label} logged ✓`);
      track("meal_logged", { meal: vars.meal_type, via: "log" });
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(TODAY_KEY, ctx.prev);
      toast.error("Couldn't save — try again");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: TODAY_KEY }),
  });

  function record(meal: MealType, status: MealStatus, notes?: string, photo?: Macros) {
    const existing = rowByMeal[meal];
    const items = plate.data?.plan[meal] ?? [];

    // The endpoint is an upsert that overwrites every column, so anything we
    // don't send is reset to null. Work out the macros this row should carry:
    let macros: Partial<Macros> = {};
    if (photo) {
      macros = photo; // AI estimate from a photo the user just took
    } else if (status === "as_planned" && items.length > 0) {
      macros = slotMacros(items);
    } else if (status === "different" && existing?.status === "different") {
      // Editing the note on an already-"different" meal must not wipe the
      // macros a previous photo estimate stored.
      macros = {
        kcal: existing.kcal ?? undefined,
        protein_g: existing.protein_g ?? undefined,
        carbs_g: existing.carbs_g ?? undefined,
        fats_g: existing.fats_g ?? undefined,
      };
    }
    mutation.mutate({ date: todayIso(), meal_type: meal, status, notes, ...macros });
  }

  return (
    <div className="space-y-4">
      {MEAL_ORDER.map((meal, i) => (
        <motion.div
          key={meal}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.soft, delay: i * 0.06 }}
        >
          <MealSlot
            meal={meal}
            items={plate.isSuccess ? (plate.data.plan[meal] ?? []) : []}
            plateLoading={plate.isLoading}
            plateError={plate.isError}
            row={rowByMeal[meal]}
            onRecord={record}
          />
        </motion.div>
      ))}
    </div>
  );
}

const MEAL_OPTIONS: { value: MealStatus; label: string; icon: React.ReactNode }[] = [
  { value: "as_planned", label: "As Planned", icon: <HugeiconsIcon icon={Tick01Icon} className="h-4 w-4" /> },
  { value: "different", label: "Different", icon: <HugeiconsIcon icon={PencilEdit01Icon} className="h-4 w-4" /> },
  { value: "skipped", label: "Skipped", icon: <HugeiconsIcon icon={NextIcon} className="h-4 w-4" /> },
];

function MealSlot({
  meal,
  items,
  plateLoading,
  plateError,
  row,
  onRecord,
}: {
  meal: MealType;
  items: PlateItem[];
  plateLoading: boolean;
  plateError: boolean;
  row?: MealLogOut;
  onRecord: (meal: MealType, status: MealStatus, notes?: string, photo?: Macros) => void;
}) {
  const status = row?.status;
  const savedNotes = row?.notes ?? "";
  const [notes, setNotes] = useState(savedNotes);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pick up notes that arrive after first render (the day's logs load async).
  useEffect(() => setNotes(savedNotes), [savedNotes]);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsPhotoLoading(true);
      const estimate = await logMealPhoto(file, meal);
      const noteStr = `Photo Log (${estimate.confidence}): ${estimate.dishes.map((d) => `${d.name} (${d.portion})`).join(", ")}`;
      setNotes(noteStr);
      // /logs/photo only *estimates* — persisting is our job, macros included.
      onRecord(meal, "different", noteStr, {
        kcal: estimate.total_kcal,
        protein_g: estimate.total_protein_g,
        carbs_g: estimate.total_carbs_g,
        fats_g: estimate.total_fats_g,
      });
      toast.success("Photo logged successfully");
    } catch {
      toast.error("Failed to analyze photo");
    } finally {
      setIsPhotoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="surface-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="label-caps text-white">{meal}</h3>
        {plateLoading ? (
          <Skeleton className="h-4 w-24" />
        ) : !plateError && items.length > 0 ? (
          <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
            {Math.round(slotMacros(items).kcal)} kcal planned
          </span>
        ) : null}
      </div>

      {!plateLoading && !plateError && items.length > 0 && (
        <p className="mb-4 text-[14px] leading-relaxed text-zinc-400">{items.map((d) => d.name).join(" · ")}</p>
      )}
      {plateError && (
        <p className="mb-4 text-[13px] text-zinc-500">No plan available — you can still log this meal.</p>
      )}

      <OptionRow
        group={`meal-${meal}`}
        options={MEAL_OPTIONS}
        value={status}
        onSelect={(v) => onRecord(meal, v, v === "different" ? notes : undefined)}
        className="mt-4"
      />

      <div className="mt-4 border-t border-border pt-4 text-center">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handlePhotoUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isPhotoLoading}
          className="inline-flex min-h-11 items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[#64D2FF] transition-transform hover:scale-105 disabled:opacity-60"
        >
          <HugeiconsIcon icon={Camera01Icon} className={cn("h-4 w-4", isPhotoLoading && "animate-spin")} />
          {isPhotoLoading ? "Analyzing photo..." : "Snap Photo"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {status === "different" && (
          <motion.div
            key="notes"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes.trim() !== savedNotes && onRecord(meal, "different", notes.trim())}
              placeholder="What did you eat instead? (optional)"
              aria-label={`What you ate for ${meal} instead`}
              className="mt-4 w-full rounded-xl border border-border bg-transparent px-4 py-3 text-[14px] text-foreground outline-none transition-colors placeholder:text-zinc-600 focus:border-accent/40 focus:bg-white/5"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── weight tab ───────────────────────────────────────────────────────────────

const MIN_KG = 30;
const MAX_KG = 200;

function WeightTab({ today, loading }: { today?: TodayLogs; loading: boolean }) {
  const qc = useQueryClient();
  const [value, setValue] = useState<string>("");

  const todaysWeight = today?.weight?.weight_kg;
  useEffect(() => {
    if (todaysWeight != null) setValue((v) => (v === "" ? String(todaysWeight) : v));
  }, [todaysWeight]);

  const mutation = useMutation({
    mutationFn: logWeight,
    onSuccess: () => {
      toast.success("Weight logged");
      track("weight_logged");
      qc.invalidateQueries({ queryKey: TODAY_KEY });
      qc.invalidateQueries({ queryKey: ["progress"] });
    },
    onError: () => toast.error("Couldn't save — try again"),
  });
  const saved = useFlash(mutation.isSuccess);

  function nudge(delta: number) {
    const next = Math.min(MAX_KG, Math.max(MIN_KG, (Number(value) || 0) + delta));
    setValue(next.toFixed(1));
  }

  function save() {
    const kg = Number(value);
    if (!kg || kg < MIN_KG || kg > MAX_KG) {
      toast.error(`Enter a weight between ${MIN_KG} and ${MAX_KG} kg`);
      return;
    }
    mutation.mutate({ date: todayIso(), weight_kg: kg });
  }

  if (loading) return <Skeleton className="h-64 rounded-3xl" />;

  const stepper = "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xl font-black text-white transition-colors hover:bg-border";

  return (
    <div className="surface-card flex flex-col items-center justify-center p-8! text-center">
      <p className="label-caps mb-4">Today&apos;s weight</p>
      <div className="mb-8 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => nudge(-0.1)} aria-label="Decrease by 0.1 kg" className={stepper}>
          −
        </motion.button>
        <div className="flex items-end gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="—"
            aria-label="Weight in kilograms"
            className="w-40 bg-transparent text-center text-[64px] font-extrabold tracking-tight text-white outline-none sm:w-48 sm:text-[72px]"
          />
          <span className="pb-4 text-xl font-bold uppercase tracking-widest text-muted-foreground">kg</span>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => nudge(0.1)} aria-label="Increase by 0.1 kg" className={stepper}>
          +
        </motion.button>
      </div>
      <SaveButton
        pending={mutation.isPending}
        saved={saved}
        disabled={!value}
        idle="Save weight"
        onClick={save}
        className="max-w-xs"
      />
    </div>
  );
}

// ── workout tab ────────────────────────────────────────────────────────────────

const WORKOUT_OPTIONS: { value: WorkoutStatus; label: string }[] = [
  { value: "done", label: "Completed" },
  { value: "partial", label: "Partial" },
  { value: "skipped", label: "Skipped" },
];

function WorkoutTab({ today }: { today?: TodayLogs }) {
  const qc = useQueryClient();
  const workout = useQuery<TodayWorkout>({
    queryKey: ["workout", "today"],
    queryFn: getTodayWorkout,
    retry: 0,
  });

  const mutation = useMutation({
    mutationFn: logWorkout,
    onSuccess: () => {
      toast.success("Workout logged");
      track("workout_saved", { via: "log" });
      qc.invalidateQueries({ queryKey: TODAY_KEY });
    },
    onError: () => toast.error("Couldn't save — try again"),
  });

  if (workout.isLoading) return <Skeleton className="h-44 rounded-3xl" />;

  if (workout.isError || !workout.data) {
    return (
      <div className="surface-card p-10! text-center">
        <HugeiconsIcon icon={Dumbbell01Icon} className="mx-auto mb-4 h-10 w-10 text-muted-foreground opacity-50" />
        <p className="text-[14px] text-muted-foreground">No workout scheduled today, or onboarding incomplete.</p>
      </div>
    );
  }

  const w = workout.data;

  function record(status: WorkoutStatus) {
    mutation.mutate({
      date: todayIso(),
      template_id: w.template_id,
      exercises_done: [],
      status,
      skip_reason: status === "skipped" ? "Logged from /log" : null,
    });
  }

  return (
    <div className="surface-card p-6!">
      <h3 className="label-caps mb-2 text-accent">{w.template_name}</h3>
      <p className="text-[14px] font-bold text-foreground">
        {w.day_name} <span className="ml-2 text-muted-foreground">Week {w.week}, Day {w.day}</span>
      </p>
      <OptionRow
        group="workout"
        options={WORKOUT_OPTIONS}
        value={today?.workout_status as WorkoutStatus | null | undefined}
        onSelect={record}
        alwaysLabel
        className="mt-6 gap-3"
      />
    </div>
  );
}

// ── mood tab ───────────────────────────────────────────────────────────────────

const EMOJI_SCALE = [
  { emoji: "🥱", label: "Very low" },
  { emoji: "😪", label: "Low" },
  { emoji: "😐", label: "Moderate" },
  { emoji: "😊", label: "Good" },
  { emoji: "🚀", label: "Excellent" },
];

function MoodTab({ today }: { today?: TodayLogs }) {
  const qc = useQueryClient();
  const s = today?.subjective;
  const [energy, setEnergy] = useState<number | null>(s?.energy ?? null);
  const [hunger, setHunger] = useState<number | null>(s?.hunger ?? null);
  const [mood, setMood] = useState<number | null>(s?.mood ?? null);

  const mutation = useMutation({
    mutationFn: logSubjective,
    onSuccess: () => {
      toast.success("Logged how you feel");
      qc.invalidateQueries({ queryKey: TODAY_KEY });
    },
    onError: () => toast.error("Couldn't save — try again"),
  });
  const saved = useFlash(mutation.isSuccess);

  return (
    <div className="space-y-4">
      <Scale5 label="Energy" value={energy} onChange={setEnergy} color="var(--accent)" />
      <Scale5 label="Hunger" value={hunger} onChange={setHunger} color="#64D2FF" />
      <Scale5 label="Mood" value={mood} onChange={setMood} color="#818cf8" />
      <SaveButton
        pending={mutation.isPending}
        saved={saved}
        disabled={energy == null && hunger == null && mood == null}
        idle="Save Check-in"
        onClick={() => mutation.mutate({ date: todayIso(), energy, hunger, mood })}
        className="mt-6"
      />
    </div>
  );
}

function Scale5({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div className="surface-card">
      <p className="label-caps mb-4" style={{ color }}>
        {label}
      </p>
      <div className="flex justify-between gap-2">
        {EMOJI_SCALE.map((item, i) => {
          const level = i + 1;
          const active = value === level;
          return (
            <motion.button
              key={level}
              whileTap={{ scale: 0.92 }}
              onClick={() => onChange(level)}
              aria-label={`${label}: ${item.label}`}
              aria-pressed={active}
              animate={{ opacity: active || value == null ? 1 : 0.4 }}
              className="relative flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl py-3 transition-colors hover:bg-white/5"
            >
              {active && (
                <motion.span
                  layoutId={`scale-${label}`}
                  transition={spring.snappy}
                  className="absolute inset-0 rounded-xl border border-white/20 bg-white/10"
                />
              )}
              <motion.span
                animate={{ scale: active ? 1.2 : 1 }}
                transition={spring.snappy}
                className="relative text-[28px]"
              >
                {item.emoji}
              </motion.span>
              <span className={cn("relative text-[9px] font-bold uppercase tracking-wider", active ? "text-white" : "text-muted-foreground")}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
