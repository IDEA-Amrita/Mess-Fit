"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, SkipForward, Dumbbell, Scale, Smile, UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/DashboardShell";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/utils";
import { optimizeToday, type OptimizationResult, type PlateItem } from "@/lib/optimizer-api";
import {
  getTodayLogs,
  logMeal,
  logSubjective,
  logWeight,
  todayIso,
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

const CARD = "rounded-xl border border-border bg-card";
const CHOICE_ACTIVE = "bg-accent-muted text-accent";
const CHOICE_IDLE = "bg-white/5 text-muted-foreground hover:text-foreground";

type Tab = "meal" | "weight" | "workout" | "mood";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "meal", label: "Meal", icon: <UtensilsCrossed className="h-4 w-4" /> },
  { id: "weight", label: "Weight", icon: <Scale className="h-4 w-4" /> },
  { id: "workout", label: "Workout", icon: <Dumbbell className="h-4 w-4" /> },
  { id: "mood", label: "Mood", icon: <Smile className="h-4 w-4" /> },
];

// ── page ─────────────────────────────────────────────────────────────────────

export default function LogPage() {
  const [tab, setTab] = useState<Tab>("meal");
  const today = useQuery({ queryKey: TODAY_KEY, queryFn: getTodayLogs });
  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <DashboardShell>
      <div className="mf-rise mx-auto w-full max-w-3xl flex-1 space-y-5 p-5 sm:p-6">
        <PageHeader title="Log" description={dateStr} />

        {/* Tab bar */}
        <div className={cn("flex gap-1 p-1", CARD)}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-colors",
                t.id === tab ? CHOICE_ACTIVE : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {tab === "meal" && <MealTab today={today.data} />}
        {tab === "weight" && <WeightTab today={today.data} loading={today.isLoading} />}
        {tab === "workout" && <WorkoutTab today={today.data} />}
        {tab === "mood" && <MoodTab today={today.data} />}
      </div>
    </DashboardShell>
  );
}

// ── meal tab ───────────────────────────────────────────────────────────────────

function slotMacros(items: PlateItem[]) {
  return items.reduce(
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
  });

  const statusByMeal = useMemo(() => {
    const map: Partial<Record<MealType, MealStatus>> = {};
    today?.meals.forEach((m) => (map[m.meal_type] = m.status));
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
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(TODAY_KEY, ctx.prev);
      toast.error("Couldn't save — try again");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: TODAY_KEY }),
  });

  function record(meal: MealType, status: MealStatus, notes?: string) {
    const items = plate.data?.plan[meal] ?? [];
    const macros = status === "as_planned" ? slotMacros(items) : {};
    mutation.mutate({ date: todayIso(), meal_type: meal, status, notes, ...macros });
  }

  return (
    <div className="space-y-3">
      {MEAL_ORDER.map((meal) => (
        <MealSlot
          key={meal}
          meal={meal}
          items={plate.data?.plan[meal] ?? []}
          plateLoading={plate.isLoading}
          plateError={plate.isError}
          status={statusByMeal[meal]}
          onRecord={record}
        />
      ))}
    </div>
  );
}

function MealSlot({
  meal,
  items,
  plateLoading,
  plateError,
  status,
  onRecord,
}: {
  meal: MealType;
  items: PlateItem[];
  plateLoading: boolean;
  plateError: boolean;
  status?: MealStatus;
  onRecord: (meal: MealType, status: MealStatus, notes?: string) => void;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");

  const options: { value: MealStatus; label: string; icon: React.ReactNode }[] = [
    { value: "as_planned", label: "As planned", icon: <Check className="h-3.5 w-3.5" /> },
    { value: "different", label: "Different", icon: <Pencil className="h-3.5 w-3.5" /> },
    { value: "skipped", label: "Skipped", icon: <SkipForward className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className={cn("p-4", CARD)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize text-foreground">{meal}</h3>
        {plateLoading ? (
          <Skeleton className="h-3 w-24 bg-white/5" />
        ) : !plateError && items.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {Math.round(slotMacros(items).kcal)} kcal planned
          </span>
        ) : null}
      </div>

      {!plateLoading && !plateError && items.length > 0 && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {items.map((d) => d.name).join(" · ")}
        </p>
      )}
      {plateError && (
        <p className="mt-1 text-xs text-muted-foreground/60">
          No plan available — you can still log this meal.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => {
              if (o.value === "different") setShowNotes(true);
              onRecord(meal, o.value, o.value === "different" ? notes : undefined);
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors",
              status === o.value ? CHOICE_ACTIVE : CHOICE_IDLE,
            )}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>

      {showNotes && status === "different" && (
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes && onRecord(meal, "different", notes)}
          placeholder="What did you eat instead? (optional)"
          className="mt-3 w-full rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
        />
      )}
    </div>
  );
}

// ── weight tab ───────────────────────────────────────────────────────────────

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
      qc.invalidateQueries({ queryKey: TODAY_KEY });
      qc.invalidateQueries({ queryKey: ["progress"] });
    },
    onError: () => toast.error("Couldn't save — try again"),
  });

  function save() {
    const kg = Number(value);
    if (!kg || kg < 30 || kg > 200) {
      toast.error("Enter a weight between 30 and 200 kg");
      return;
    }
    mutation.mutate({ date: todayIso(), weight_kg: kg });
  }

  if (loading) return <Skeleton className="h-48 rounded-xl bg-white/5" />;

  return (
    <div className={cn("p-6", CARD)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Today&apos;s weight
      </p>
      <div className="mt-3 flex items-end gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="—"
          aria-label="Weight in kilograms"
          className="w-40 bg-transparent text-5xl font-bold text-foreground outline-none"
        />
        <span className="pb-2 text-lg font-medium text-muted-foreground">kg</span>
      </div>
      <Button onClick={save} disabled={mutation.isPending} size="lg" className="mt-5 w-full">
        {mutation.isPending ? "Saving…" : "Save weight"}
      </Button>
    </div>
  );
}

// ── workout tab ────────────────────────────────────────────────────────────────

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
      qc.invalidateQueries({ queryKey: TODAY_KEY });
    },
    onError: () => toast.error("Couldn't save — try again"),
  });

  if (workout.isLoading) return <Skeleton className="h-44 rounded-xl bg-white/5" />;

  if (workout.isError || !workout.data) {
    return (
      <div className={cn("p-6 text-center", CARD)}>
        <p className="text-sm text-muted-foreground">
          No workout scheduled today, or onboarding incomplete.
        </p>
      </div>
    );
  }

  const w = workout.data;
  const opts: { value: WorkoutStatus; label: string }[] = [
    { value: "done", label: "Done" },
    { value: "partial", label: "Partial" },
    { value: "skipped", label: "Skipped" },
  ];

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
    <div className={cn("p-4", CARD)}>
      <h3 className="text-sm font-semibold capitalize text-foreground">{w.template_name}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {w.day_name} · {w.exercises.length} exercises · Week {w.week}, Day {w.day}
      </p>
      <div className="mt-3 flex gap-2">
        {opts.map((o) => (
          <button
            key={o.value}
            onClick={() => record(o.value)}
            className={cn(
              "flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors",
              today?.workout_status === o.value ? CHOICE_ACTIVE : CHOICE_IDLE,
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── mood tab ───────────────────────────────────────────────────────────────────

const EMOJI = ["🥱", "😪", "😐", "😊", "🚀"];

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

  function save() {
    mutation.mutate({ date: todayIso(), energy, hunger, mood });
  }

  return (
    <div className="space-y-3">
      <Scale5 label="Energy" value={energy} onChange={setEnergy} />
      <Scale5 label="Hunger" value={hunger} onChange={setHunger} />
      <Scale5 label="Mood" value={mood} onChange={setMood} />
      <Button
        onClick={save}
        disabled={mutation.isPending || (energy == null && hunger == null && mood == null)}
        size="lg"
        className="w-full"
      >
        {mutation.isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

function Scale5({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className={cn("p-4", CARD)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex justify-between gap-2">
        {EMOJI.map((e, i) => {
          const level = i + 1;
          const active = value === level;
          return (
            <button
              key={level}
              onClick={() => onChange(level)}
              aria-label={`${label} ${level}`}
              className={cn(
                "flex h-12 flex-1 items-center justify-center rounded-lg text-2xl transition-all",
                active ? "bg-accent-muted ring-1 ring-accent/40" : "bg-white/5",
                active || value == null ? "opacity-100" : "opacity-40",
              )}
            >
              {e}
            </button>
          );
        })}
      </div>
    </div>
  );
}
