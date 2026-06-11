"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sunrise, Sun, Coffee, Moon, RefreshCw, AlertCircle, ShoppingBag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { DashboardShell } from "@/components/DashboardShell";
import {
  optimizeToday,
  type OptimizationResult,
  type PlateItem,
  type GapFill,
} from "@/lib/optimizer-api";
import { ApiError } from "@/lib/api";

// ── constants ────────────────────────────────────────────────────────────

const MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner"] as const;

function getMealMeta(meal: string) {
  switch (meal) {
    case "breakfast":
      return { icon: <Sunrise className="w-4 h-4" />, color: "#f59e0b", label: "Breakfast" };
    case "lunch":
      return { icon: <Sun className="w-4 h-4" />, color: "#eab308", label: "Lunch" };
    case "snack":
      return { icon: <Coffee className="w-4 h-4" />, color: "#f97316", label: "Snack" };
    case "dinner":
      return { icon: <Moon className="w-4 h-4" />, color: "#818cf8", label: "Dinner" };
    default:
      return { icon: null, color: "#666", label: meal };
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
    <div
      className="rounded-2xl p-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
          {label}
        </span>
        <span className="text-xs font-medium" style={{ color: over ? "#f87171" : "#888" }}>
          {Math.round(current)}{unit}
          <span style={{ color: "#333" }}> / {Math.round(target)}{unit}</span>
        </span>
      </div>
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: over ? "#f87171" : barColor }}
        />
      </div>
    </div>
  );
}

function DishCard({ item }: { item: PlateItem }) {
  const portionsLabel =
    Number.isInteger(item.portions)
      ? `${item.portions}×`
      : `${item.portions.toFixed(1)}×`;

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm leading-snug" style={{ color: "#e8e8e8" }}>
          {item.name}
        </p>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
        >
          {Math.round(item.kcal)} kcal
        </span>
      </div>

      <p className="text-xs" style={{ color: "#555" }}>
        {portionsLabel} {item.serving_unit} · {Math.round(item.grams)}g
      </p>

      <div
        className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium"
        style={{ background: "rgba(0,0,0,0.2)" }}
      >
        <span style={{ color: "#60a5fa" }}>P {item.protein_g.toFixed(1)}g</span>
        <span style={{ color: "#fbbf24" }}>C {item.carbs_g.toFixed(1)}g</span>
        <span style={{ color: "#f87171" }}>F {item.fats_g.toFixed(1)}g</span>
      </div>

      {item.reason && (
        <p className="text-xs leading-relaxed" style={{ color: "#3f3f3f" }}>
          {item.reason}
        </p>
      )}
    </div>
  );
}

function MealSection({ meal, items }: { meal: string; items: PlateItem[] }) {
  const meta = getMealMeta(meal);
  const mealKcal = items.reduce((s, d) => s + d.kcal, 0);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: "rgba(255,255,255,0.05)", color: meta.color }}
        >
          {meta.icon}
        </div>
        <h3 className="font-semibold text-sm" style={{ color: "#c0c0c0" }}>
          {meta.label}
        </h3>
        <span className="text-xs" style={{ color: "#444" }}>
          {Math.round(mealKcal)} kcal
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <DishCard key={item.dish_id} item={item} />
        ))}
      </div>
    </section>
  );
}

function GapFillCard({ fill }: { fill: GapFill }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{
        background: "rgba(99,102,241,0.05)",
        border: "1px solid rgba(99,102,241,0.15)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm" style={{ color: "#e8e8e8" }}>
          {fill.name}
        </p>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}
        >
          ₹{fill.cost_inr}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs font-medium" style={{ color: "#555" }}>
        <span>{Math.round(fill.kcal)} kcal</span>
        <span style={{ color: "#60a5fa" }}>P {fill.protein_g.toFixed(1)}g</span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "#555" }}>
        {fill.text}
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl bg-white/5" />
        ))}
      </div>
      {[0, 1].map((s) => (
        <div key={s} className="space-y-3">
          <Skeleton className="h-8 w-32 rounded-xl bg-white/5" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── page ────────────────────────────────────────────────────────────────

export default function PlatePage() {
  const router = useRouter();
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);

  const fetchPlate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await optimizeToday();
      setResult(data);
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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <DashboardShell>
      {/* Top bar */}
      <header
        className="flex h-16 shrink-0 items-center justify-between border-b px-6"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: "#f0f0f0" }}>
            Today&apos;s Plate
          </h1>
          <p className="text-xs" style={{ color: "#444" }}>
            {today}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPlate}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "#888" }}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          {/* Mobile sign-out */}
          <button
            onClick={handleLogout}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium lg:hidden"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "#666" }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Body */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState error={error} />
      ) : result ? (
        <PlateView result={result} />
      ) : null}
    </DashboardShell>
  );
}

// ── error state ──────────────────────────────────────────────────────────

function ErrorState({ error }: { error: { message: string; status?: number } }) {
  const isOnboarding = error.status === 409;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "rgba(248,113,113,0.1)" }}
      >
        <AlertCircle className="w-7 h-7" style={{ color: "#f87171" }} />
      </div>
      <div>
        <p className="font-semibold" style={{ color: "#d0d0d0" }}>
          {isOnboarding ? "Onboarding required" : "Couldn't load your plate"}
        </p>
        <p className="mt-1 max-w-xs text-sm leading-relaxed" style={{ color: "#555" }}>
          {error.message}
        </p>
      </div>
      {isOnboarding && (
        <Link
          href="/onboarding"
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
        >
          Complete onboarding
        </Link>
      )}
    </div>
  );
}

// ── plate view ───────────────────────────────────────────────────────────

function PlateView({ result }: { result: OptimizationResult }) {
  const { plan, daily_totals: totals, daily_targets: targets, gap_fills, solver_status, solve_time_ms } = result;

  const mealsInPlan = MEAL_ORDER.filter((m) => (plan[m]?.length ?? 0) > 0);

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Macro summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MacroCard
          label="Kcal"
          current={totals.kcal}
          target={targets.kcal}
          unit=" kcal"
          barColor="#f59e0b"
        />
        <MacroCard
          label="Protein"
          current={totals.protein_g}
          target={targets.protein_g}
          unit="g"
          barColor="#60a5fa"
        />
        <MacroCard
          label="Carbs"
          current={totals.carbs_g}
          target={targets.carbs_g}
          unit="g"
          barColor="#fbbf24"
        />
        <MacroCard
          label="Fats"
          current={totals.fats_g}
          target={targets.fats_g}
          unit="g"
          barColor="#f87171"
        />
      </div>

      {/* Solver meta */}
      {solver_status && (
        <p className="text-xs" style={{ color: "#2a2a2a" }}>
          {solver_status} · {solve_time_ms}ms
        </p>
      )}

      {/* Meal sections */}
      {mealsInPlan.length === 0 ? (
        <div
          className="flex min-h-48 flex-col items-center justify-center rounded-2xl p-8 text-center"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px dashed rgba(255,255,255,0.06)",
          }}
        >
          <p className="font-medium" style={{ color: "#444" }}>
            No dishes in plan
          </p>
          <p className="mt-1 text-xs" style={{ color: "#333" }}>
            The solver returned an empty plate. Try refreshing or check your mess menu.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {mealsInPlan.map((meal) => (
            <MealSection key={meal} meal={meal} items={plan[meal]} />
          ))}
        </div>
      )}

      {/* Gap fills */}
      {gap_fills.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}
            >
              <ShoppingBag className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm" style={{ color: "#c0c0c0" }}>
              Canteen top-ups
            </h3>
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
