"use client";
import { HugeiconsIcon } from "@hugeicons/react";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sun01Icon, Coffee01Icon, Moon01Icon, RefreshIcon, Alert01Icon, ShoppingBag01Icon, Tick01Icon, Camera02Icon } from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { DashboardShell } from "@/components/DashboardShell";
import { PortionIcon } from "@/components/PortionIcon";
import {
  optimizeToday,
  optimizeFromPhoto,
  type OptimizationResult,
  type PlateItem,
  type GapFill,
} from "@/lib/optimizer-api";
import { logMeal, todayIso, type MealType } from "@/lib/tracking-api";
import { submitDishFeedback } from "@/lib/mess-api";
import { toast } from "@/lib/toast-store";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── constants ────────────────────────────────────────────────────────────

const MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner"] as const;

function getMealMeta(meal: string) {
  switch (meal) {
    case "breakfast":
      return { icon: <HugeiconsIcon icon={Sun01Icon} className="h-4 w-4" />, color: "#f59e0b", label: "Breakfast" };
    case "lunch":
      return { icon: <HugeiconsIcon icon={Sun01Icon} className="h-4 w-4" />, color: "#eab308", label: "Lunch" };
    case "snack":
      return { icon: <HugeiconsIcon icon={Coffee01Icon} className="h-4 w-4" />, color: "#f97316", label: "Snack" };
    case "dinner":
      return { icon: <HugeiconsIcon icon={Moon01Icon} className="h-4 w-4" />, color: "#818cf8", label: "Dinner" };
    default:
      return { icon: null, color: "var(--text-muted)", label: meal };
  }
}

// ── sub-components ───────────────────────────────────────────────────────

function MacroCard({
  label,
  current,
  target,
  unit,
  barColor,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  barColor: string;
}) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const over = current > target * 1.05;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className={cn("text-xs font-medium", over ? "text-destructive" : "text-foreground")}>
          {Math.round(current)}
          {unit}
          <span className="text-muted-foreground">
            {" "}
            / {Math.round(target)}
            {unit}
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: over ? "var(--destructive)" : barColor }}
        />
      </div>
    </div>
  );
}

function DishCard({ item, meal }: { item: PlateItem; meal: string }) {
  const portionsLabel = Number.isInteger(item.portions)
    ? `${item.portions}×`
    : `${item.portions.toFixed(1)}×`;

  const [vote, setVote] = useState<"confirm" | "deny" | null>(null);
  
  const voteMutation = useMutation({
    mutationFn: (v: "confirm" | "deny") => submitDishFeedback({
      date: todayIso(),
      meal_type: meal,
      dish_id: item.dish_id,
      vote: v,
    }),
    onSuccess: (_, variables) => {
      setVote(variables);
      toast.success("Thanks for verifying the menu!");
    },
  });

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-foreground">{item.name}</p>
        <span className="shrink-0 rounded-full bg-accent-muted px-2 py-0.5 text-[11px] font-semibold text-accent">
          {Math.round(item.kcal)} kcal
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <PortionIcon icon={item.portion_icon} size={14} color="currentColor" />
        <span>
          {portionsLabel} {item.serving_unit} · {Math.round(item.grams)}g
        </span>
      </div>

      <div className="flex items-center gap-3 rounded-lg bg-black/20 px-2.5 py-2 text-xs font-medium">
        <span style={{ color: "#60a5fa" }}>P {item.protein_g.toFixed(1)}g</span>
        <span style={{ color: "#fbbf24" }}>C {item.carbs_g.toFixed(1)}g</span>
        <span style={{ color: "#f87171" }}>F {item.fats_g.toFixed(1)}g</span>
      </div>

      {item.reason && (
        <p className="text-xs leading-relaxed text-muted-foreground">{item.reason}</p>
      )}

      {/* Crowdsourcing Feedback UI */}
      <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          Served today?
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => voteMutation.mutate("confirm")}
            disabled={vote !== null || voteMutation.isPending}
            className={cn(
              "flex h-7 items-center justify-center rounded bg-white/5 px-2.5 text-xs transition-colors",
              vote === "confirm" ? "bg-green-500/20 text-green-500" : "text-muted-foreground hover:bg-white/10 hover:text-foreground",
              vote === "deny" && "opacity-30"
            )}
          >
            Yes
          </button>
          <button
            onClick={() => voteMutation.mutate("deny")}
            disabled={vote !== null || voteMutation.isPending}
            className={cn(
              "flex h-7 items-center justify-center rounded bg-white/5 px-2.5 text-xs transition-colors",
              vote === "deny" ? "bg-red-500/20 text-red-500" : "text-muted-foreground hover:bg-white/10 hover:text-foreground",
              vote === "confirm" && "opacity-30"
            )}
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}

function MealSection({ meal, items }: { meal: string; items: PlateItem[] }) {
  const meta = getMealMeta(meal);
  const mealKcal = items.reduce((s, d) => s + d.kcal, 0);
  const qc = useQueryClient();

  const logMutation = useMutation({
    mutationFn: logMeal,
    onSuccess: () => {
      const label = meal.charAt(0).toUpperCase() + meal.slice(1);
      toast.success(`${label} logged as planned ✓`);
      qc.invalidateQueries({ queryKey: ["logs", "today"] });
    },
    onError: () => toast.error("Couldn't log — try again"),
  });

  function handleLogAsPlanned() {
    const macros = items.reduce(
      (acc, d) => ({
        kcal: acc.kcal + d.kcal,
        protein_g: acc.protein_g + d.protein_g,
        carbs_g: acc.carbs_g + d.carbs_g,
        fats_g: acc.fats_g + d.fats_g,
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
    );
    logMutation.mutate({
      date: todayIso(),
      meal_type: meal as MealType,
      status: "as_planned",
      ...macros,
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2"
          style={{ color: meta.color }}
        >
          {meta.icon}
        </div>
        <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
        <span className="text-xs text-muted-foreground">{Math.round(mealKcal)} kcal</span>
        <button
          onClick={handleLogAsPlanned}
          disabled={logMutation.isPending}
          className="ml-auto flex items-center gap-1 rounded-lg bg-accent-muted px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
        >
          <HugeiconsIcon icon={Tick01Icon} className="h-3 w-3" />
          {logMutation.isPending ? "Logging…" : "Log as planned"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <DishCard key={item.dish_id} item={item} meal={meal} />
        ))}
      </div>
    </section>
  );
}

function GapFillCard({ fill }: { fill: GapFill }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-4"
      style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{fill.name}</p>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}
        >
          ₹{fill.cost_inr}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
        <span>{Math.round(fill.kcal)} kcal</span>
        <span style={{ color: "#60a5fa" }}>P {fill.protein_g.toFixed(1)}g</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{fill.text}</p>
    </div>
  );
}

function LoadingSkeleton({ message = "" }: { message?: string }) {
  return (
    <div className="space-y-6">
      {message && (
        <div className="flex animate-pulse items-center justify-center rounded-xl border border-accent/20 bg-accent/5 py-4 text-sm font-medium text-accent shadow-glow">
          {message}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl bg-white/5" />
        ))}
      </div>
      {[0, 1].map((s) => (
        <div key={s} className="space-y-3">
          <Skeleton className="h-8 w-32 rounded-xl bg-white/5" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── page ────────────────────────────────────────────────────────────────

export default function PlatePage() {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPlate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await optimizeToday());
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ message: err.detail, status: err.status });
      } else {
        setError({ message: "Something went wrong. Please try again." });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlate();
  }, [fetchPlate]);

  const handleScanPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setError(null);
    try {
      setResult(await optimizeFromPhoto(file));
      toast.success("AI successfully optimized your plate!");
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ message: err.detail, status: err.status });
      } else {
        setError({ message: "Failed to process photo. Please try again." });
      }
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <DashboardShell>
      <div className="mf-rise mx-auto w-full max-w-5xl flex-1 space-y-6 p-5 sm:p-6">
        <PageHeader
          title="Today's Plate"
          description={today}
          actions={
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleScanPhoto}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || isScanning}
                aria-label="AI Scan"
                className="flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/20 hover:shadow-glow disabled:opacity-40"
              >
                <HugeiconsIcon icon={isScanning ? RefreshIcon : Camera02Icon} className={cn("h-3 w-3", isScanning && "animate-spin")} />
                {isScanning ? "Scanning..." : "AI Scan"}
              </button>
              <button
                onClick={fetchPlate}
                disabled={loading || isScanning}
                aria-label="Refresh plate"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                <HugeiconsIcon icon={RefreshIcon} className={cn("h-3 w-3", loading && "animate-spin")} />
                Refresh
              </button>
            </div>
          }
        />

        {loading || isScanning ? (
          <LoadingSkeleton message={isScanning ? "AI is extracting foods and calculating your optimal plate..." : ""} />
        ) : error ? (
          <ErrorState error={error} />
        ) : result ? (
          <PlateView result={result} />
        ) : null}
      </div>
    </DashboardShell>
  );
}

// ── error state ──────────────────────────────────────────────────────────

function ErrorState({ error }: { error: { message: string; status?: number } }) {
  const isOnboarding = error.status === 409;
  return (
    <EmptyState
      icon={<HugeiconsIcon icon={Alert01Icon} className="h-6 w-6" />}
      title={isOnboarding ? "Onboarding required" : "Couldn't load your plate"}
      description={error.message}
      action={
        isOnboarding ? (
          <Link href="/onboarding/hostel" className={buttonVariants({ variant: "default" })}>
            Complete onboarding
          </Link>
        ) : undefined
      }
    />
  );
}

// ── plate view ───────────────────────────────────────────────────────────

function PlateView({ result }: { result: OptimizationResult }) {
  const {
    plan,
    daily_totals: totals,
    daily_targets: targets,
    gap_fills,
    solver_status,
    solve_time_ms,
  } = result;

  const mealsInPlan = MEAL_ORDER.filter((m) => (plan[m]?.length ?? 0) > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MacroCard label="Kcal" current={totals.kcal} target={targets.kcal} unit=" kcal" barColor="#f59e0b" />
        <MacroCard label="Protein" current={totals.protein_g} target={targets.protein_g} unit="g" barColor="#60a5fa" />
        <MacroCard label="Carbs" current={totals.carbs_g} target={targets.carbs_g} unit="g" barColor="#fbbf24" />
        <MacroCard label="Fats" current={totals.fats_g} target={targets.fats_g} unit="g" barColor="#f87171" />
      </div>

      {solver_status && (
        <p className="text-xs text-muted-foreground/60">
          {solver_status} · {solve_time_ms}ms
        </p>
      )}

      {mealsInPlan.length === 0 ? (
        <EmptyState
          title="No dishes in plan"
          description="The solver returned an empty plate. Try refreshing or check your mess menu."
        />
      ) : (
        <div className="space-y-8">
          {mealsInPlan.map((meal) => (
            <MealSection key={meal} meal={meal} items={plan[meal]} />
          ))}
        </div>
      )}

      {gap_fills.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}
            >
              <HugeiconsIcon icon={ShoppingBag01Icon} className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Canteen top-ups</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gap_fills.map((fill) => (
              <GapFillCard key={fill.item_id} fill={fill} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
