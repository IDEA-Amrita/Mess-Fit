"use client";
import { HugeiconsIcon } from "@hugeicons/react";

import { useEffect, useMemo, useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tick01Icon, PencilEdit01Icon, NextIcon, Dumbbell01Icon, WeightScale01Icon, SmileIcon, Restaurant01Icon, Camera01Icon } from "@hugeicons/core-free-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardShell } from "@/components/DashboardShell";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/utils";
import { optimizeToday, type OptimizationResult, type PlateItem } from "@/lib/optimizer-api";
import {
  getTodayLogs,
  logMeal,
  logMealPhoto,
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

type Tab = "meal" | "weight" | "workout" | "mood";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "meal", label: "Meal", icon: <HugeiconsIcon icon={Restaurant01Icon} className="h-4 w-4" /> },
  { id: "weight", label: "Weight", icon: <HugeiconsIcon icon={WeightScale01Icon} className="h-4 w-4" /> },
  { id: "workout", label: "Workout", icon: <HugeiconsIcon icon={Dumbbell01Icon} className="h-4 w-4" /> },
  { id: "mood", label: "Mood", icon: <HugeiconsIcon icon={SmileIcon} className="h-4 w-4" /> },
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
      <div className="mf-rise mx-auto w-full max-w-3xl flex-1 space-y-6 p-5 sm:p-6 lg:p-8">
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.04em", color: "#f4f4f5" }}>
              Daily Log
            </h1>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "#a1a1aa", marginTop: "4px" }}>
              {dateStr}
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="glass-card flex gap-1 p-1" style={{ borderRadius: "16px" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold transition-all",
                t.id === tab ? "text-accent bg-accent/20" : "text-muted-foreground hover:text-white hover:bg-white/5",
              )}
              style={t.id === tab ? { background: "rgba(204,255,0,0.15)", color: "#ccff00", boxShadow: "0 0 10px rgba(204,255,0,0.1)" } : {}}
            >
              {t.icon}
              <span className="hidden sm:inline uppercase tracking-wider text-[11px]">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "meal" && <MealTab today={today.data} />}
          {tab === "weight" && <WeightTab today={today.data} loading={today.isLoading} />}
          {tab === "workout" && <WorkoutTab today={today.data} />}
          {tab === "mood" && <MoodTab today={today.data} />}
        </div>
      </div>

      <style jsx global>{`
        .glass-card {
          position: relative;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
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
    staleTime: 0,
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
    onSuccess: (_data, vars) => {
      const label = vars.meal_type.charAt(0).toUpperCase() + vars.meal_type.slice(1);
      toast.success(`${label} logged ✓`);
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(TODAY_KEY, ctx.prev);
      toast.error("Couldn't save — try again");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: TODAY_KEY }),
  });

  function record(meal: MealType, status: MealStatus, notes?: string) {
    const items = plate.data?.plan[meal] ?? [];
    const macros = status === "as_planned" && items.length > 0 ? slotMacros(items) : {};
    mutation.mutate({ date: todayIso(), meal_type: meal, status, notes, ...macros });
  }

  const plateAvailable = plate.isSuccess && plate.data;

  return (
    <div className="space-y-4">
      {MEAL_ORDER.map((meal) => (
        <MealSlot
          key={meal}
          meal={meal}
          items={plateAvailable ? (plate.data.plan[meal] ?? []) : []}
          plateLoading={plate.isLoading}
          plateError={false}
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
  onRecord: (meal: MealType, status: MealStatus, notes?: string, photoKcal?: number, photoP?: number, photoC?: number, photoF?: number) => void;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const options: { value: MealStatus; label: string; icon: React.ReactNode }[] = [
    { value: "as_planned", label: "As Planned", icon: <HugeiconsIcon icon={Tick01Icon} className="h-4 w-4" /> },
    { value: "different", label: "Different", icon: <HugeiconsIcon icon={PencilEdit01Icon} className="h-4 w-4" /> },
    { value: "skipped", label: "Skipped", icon: <HugeiconsIcon icon={NextIcon} className="h-4 w-4" /> },
  ];

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsPhotoLoading(true);
      const estimate = await logMealPhoto(file, meal);
      
      const noteStr = `Photo Log (${estimate.confidence}): ${estimate.dishes.map(d => `${d.name} (${d.portion})`).join(", ")}`;
      setNotes(noteStr);
      
      onRecord(meal, "different", noteStr, estimate.total_kcal, estimate.total_protein_g, estimate.total_carbs_g, estimate.total_fats_g);
      toast.success("Photo logged successfully");
    } catch (err) {
      toast.error("Failed to analyze photo");
    } finally {
      setIsPhotoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="glass-card p-5" style={{ borderRadius: "1.5rem" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="label-caps" style={{ color: "#f4f4f5" }}>{meal}</h3>
        {plateLoading ? (
          <Skeleton className="h-4 w-24 bg-white/5" />
        ) : !plateError && items.length > 0 ? (
          <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
            {Math.round(slotMacros(items).kcal)} kcal planned
          </span>
        ) : null}
      </div>

      {!plateLoading && !plateError && items.length > 0 && (
        <p className="text-[14px] leading-relaxed text-zinc-400 mb-4">
          {items.map((d) => d.name).join(" · ")}
        </p>
      )}
      {plateError && (
        <p className="text-[13px] text-zinc-500 mb-4">
          No plan available — you can still log this meal.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {options.map((o) => {
          const isActive = status === o.value;
          return (
            <button
              key={o.value}
              onClick={() => {
                if (o.value === "different") setShowNotes(true);
                onRecord(meal, o.value, o.value === "different" ? notes : undefined);
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-[12px] font-bold transition-all"
              style={
                isActive
                  ? { background: "rgba(204,255,0,0.15)", color: "#ccff00", border: "1px solid rgba(204,255,0,0.3)" }
                  : { background: "rgba(255,255,255,0.03)", color: "#a1a1aa", border: "1px solid transparent" }
              }
            >
              {o.icon}
              <span className="hidden sm:inline uppercase tracking-wider text-[10px]">{o.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-center border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
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
          className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider transition-all hover:scale-105"
          style={{ color: "#8fd5ff" }}
        >
          <HugeiconsIcon icon={Camera01Icon} className={cn("h-4 w-4", isPhotoLoading && "animate-spin")} />
          {isPhotoLoading ? "Analyzing photo..." : "Snap Photo"}
        </button>
      </div>

      {showNotes && status === "different" && (
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes && onRecord(meal, "different", notes)}
          placeholder="What did you eat instead? (optional)"
          className="mt-4 w-full rounded-xl bg-transparent px-4 py-3 text-[14px] text-foreground outline-none transition-all placeholder:text-zinc-600 focus:bg-white/5"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
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

  if (loading) return <Skeleton className="h-48 rounded-[1.5rem] bg-white/5" />;

  return (
    <div className="glass-card p-8 flex flex-col items-center justify-center text-center" style={{ borderRadius: "1.5rem" }}>
      <p className="label-caps mb-4" style={{ color: "#a1a1aa" }}>
        Today&apos;s weight
      </p>
      <div className="flex items-end gap-2 mb-8">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="—"
          aria-label="Weight in kilograms"
          className="w-48 bg-transparent text-center font-extrabold outline-none"
          style={{ fontSize: "72px", color: "#f4f4f5", letterSpacing: "-0.03em" }}
        />
        <span className="pb-4 text-xl font-bold uppercase tracking-widest" style={{ color: "#71717a" }}>kg</span>
      </div>
      <button 
        onClick={save} 
        disabled={mutation.isPending || !value} 
        className="w-full max-w-xs rounded-full py-4 text-[14px] font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
        style={{ background: "#ccff00", color: "#1b1304", boxShadow: "0 0 20px rgba(204,255,0,0.2)" }}
      >
        {mutation.isPending ? "Saving…" : "Save weight"}
      </button>
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

  if (workout.isLoading) return <Skeleton className="h-44 rounded-[1.5rem] bg-white/5" />;

  if (workout.isError || !workout.data) {
    return (
      <div className="glass-card p-10 text-center" style={{ borderRadius: "1.5rem" }}>
        <HugeiconsIcon icon={Dumbbell01Icon} className="mx-auto h-10 w-10 mb-4 opacity-50" style={{ color: "#a1a1aa" }} />
        <p className="text-[14px]" style={{ color: "#a1a1aa" }}>
          No workout scheduled today, or onboarding incomplete.
        </p>
      </div>
    );
  }

  const w = workout.data;
  const opts: { value: WorkoutStatus; label: string }[] = [
    { value: "done", label: "Completed" },
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
    <div className="glass-card p-6" style={{ borderRadius: "1.5rem" }}>
      <h3 className="label-caps mb-2" style={{ color: "#ccff00" }}>{w.template_name}</h3>
      <p className="text-[14px] font-bold text-foreground">
        {w.day_name} <span className="text-muted-foreground ml-2">Week {w.week}, Day {w.day}</span>
      </p>
      <div className="mt-6 flex gap-3">
        {opts.map((o) => {
          const isActive = today?.workout_status === o.value;
          return (
            <button
              key={o.value}
              onClick={() => record(o.value)}
              className="flex-1 rounded-xl py-3 text-[12px] font-bold uppercase tracking-wider transition-all"
              style={
                isActive
                  ? { background: "rgba(204,255,0,0.15)", color: "#ccff00", border: "1px solid rgba(204,255,0,0.3)" }
                  : { background: "rgba(255,255,255,0.03)", color: "#a1a1aa", border: "1px solid transparent" }
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
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

  function save() {
    mutation.mutate({ date: todayIso(), energy, hunger, mood });
  }

  return (
    <div className="space-y-4">
      <Scale5 label="Energy" value={energy} onChange={setEnergy} color="#ccff00" />
      <Scale5 label="Hunger" value={hunger} onChange={setHunger} color="#8fd5ff" />
      <Scale5 label="Mood" value={mood} onChange={setMood} color="#818cf8" />
      <button
        onClick={save}
        disabled={mutation.isPending || (energy == null && hunger == null && mood == null)}
        className="mt-6 w-full rounded-full py-4 text-[14px] font-bold transition-all disabled:opacity-40 hover:scale-[1.02] active:scale-95"
        style={{ background: "#ccff00", color: "#1b1304", boxShadow: "0 0 20px rgba(204,255,0,0.2)" }}
      >
        {mutation.isPending ? "Saving…" : "Save Check-in"}
      </button>
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
    <div className="glass-card p-5" style={{ borderRadius: "1.5rem" }}>
      <p className="label-caps mb-4" style={{ color }}>{label}</p>
      <div className="flex justify-between gap-2">
        {EMOJI_SCALE.map((item, i) => {
          const level = i + 1;
          const active = value === level;
          return (
            <button
              key={level}
              onClick={() => onChange(level)}
              aria-label={`${label}: ${item.label}`}
              className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl py-3 transition-all hover:bg-white/5"
              style={
                active
                  ? { background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", transform: "scale(1.05)" }
                  : { background: "transparent", border: "1px solid transparent", opacity: value == null ? 1 : 0.4 }
              }
            >
              <span className="text-[28px]">{item.emoji}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: active ? "#f4f4f5" : "#71717a" }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
