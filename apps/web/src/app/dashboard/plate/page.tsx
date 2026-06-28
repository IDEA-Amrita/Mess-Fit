"use client";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, AnimatePresence } from "framer-motion";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Sun01Icon, Coffee01Icon, Moon01Icon, RefreshIcon, Alert01Icon, ShoppingBag01Icon, Tick01Icon, Camera02Icon } from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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
      return { icon: <HugeiconsIcon icon={Sun01Icon} className="h-4 w-4" />, color: "#fbbf24", label: "Lunch" };
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
    <motion.div 
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="glass-card flex flex-col justify-between p-5 min-h-[120px]"
    >
      <div className="flex items-center justify-between">
        <span className="label-caps" style={{ color: barColor }}>{label}</span>
      </div>
      <div>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="tabular-nums" style={{ fontSize: "28px", fontWeight: 800, color: over ? "#ef4444" : "#f4f4f5", letterSpacing: "-0.02em" }}>
            <motion.span
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ duration: 0.5, delay: 0.2 }}
            >
               {Math.round(current)}
            </motion.span>
          </span>
          <span style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: 600 }}>/ {Math.round(target)}{unit}</span>
        </div>
        <div className="mt-3 overflow-hidden rounded-full" style={{ height: "4px", background: "rgba(255,255,255,0.05)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 15, delay: 0.2 }}
            className="h-full rounded-full"
            style={{ background: over ? "#ef4444" : barColor, boxShadow: `0 0 12px ${over ? "#ef4444" : barColor}40` }}
          />
        </div>
      </div>
    </motion.div>
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
      toast.success("Verified. Our AI is learning!");
    },
  });

  return (
    <motion.div 
      layout
      whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.18)", boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6)" }}
      className="glass-card group flex flex-col p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p style={{ fontSize: "16px", fontWeight: 700, color: "#f4f4f5", letterSpacing: "-0.01em", lineHeight: 1.3 }}>{item.name}</p>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
          {Math.round(item.kcal)} kcal
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5" style={{ fontSize: "13px", color: "#a1a1aa", fontWeight: 500 }}>
        <PortionIcon icon={item.portion_icon} size={14} color="currentColor" />
        <span>{portionsLabel} {item.serving_unit} · {Math.round(item.grams)}g</span>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ color: "#60a5fa" }}>P {item.protein_g.toFixed(1)}g</span>
        <span style={{ color: "#fbbf24" }}>C {item.carbs_g.toFixed(1)}g</span>
        <span style={{ color: "#f87171" }}>F {item.fats_g.toFixed(1)}g</span>
      </div>

      {item.reason && (
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "#a1a1aa" }}>{item.reason}</p>
      )}

      {/* Crowdsourcing Feedback UI */}
      <div className="mt-4 flex items-center justify-between border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <span className="label-caps" style={{ color: "#71717a" }}>Served today?</span>
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => voteMutation.mutate("confirm")}
            disabled={vote !== null || voteMutation.isPending}
            className={cn(
              "flex h-8 items-center justify-center rounded-lg px-3 text-[11px] font-bold transition-colors",
              vote === "confirm" ? "bg-green-500/20 text-green-500 border border-green-500/30" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white border border-white/5",
              vote === "deny" && "opacity-30"
            )}
          >
            Yes
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => voteMutation.mutate("deny")}
            disabled={vote !== null || voteMutation.isPending}
            className={cn(
              "flex h-8 items-center justify-center rounded-lg px-3 text-[11px] font-bold transition-colors",
              vote === "deny" ? "bg-red-500/20 text-red-500 border border-red-500/30" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white border border-white/5",
              vote === "confirm" && "opacity-30"
            )}
          >
            No
          </motion.button>
        </div>
      </div>
    </motion.div>
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <motion.div
          whileHover={{ rotate: 15 }}
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: "rgba(255,255,255,0.05)", color: meta.color, border: "1px solid rgba(255,255,255,0.05)" }}
        >
          {meta.icon}
        </motion.div>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#f4f4f5" }}>{meta.label}</h3>
          <span style={{ fontSize: "13px", color: "#a1a1aa", fontWeight: 500 }}>{Math.round(mealKcal)} kcal</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleLogAsPlanned}
          disabled={logMutation.isPending}
          className="ml-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold transition-all disabled:opacity-40"
          style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}
        >
          <HugeiconsIcon icon={Tick01Icon} className="h-3.5 w-3.5" />
          {logMutation.isPending ? "Logging…" : "Log as planned"}
        </motion.button>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {items.map((item) => (
          <motion.div key={item.dish_id} variants={itemVariants}>
             <DishCard item={item} meal={meal} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function GapFillCard({ fill }: { fill: GapFill }) {
  return (
    <motion.div
      whileHover={{ y: -4, borderColor: "rgba(129,140,248,0.4)" }}
      className="glass-card flex flex-col p-5"
      style={{ border: "1px solid rgba(129,140,248,0.2)", background: "rgba(129,140,248,0.05)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <p style={{ fontSize: "15px", fontWeight: 700, color: "#f4f4f5" }}>{fill.name}</p>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ background: "rgba(129,140,248,0.15)", color: "#a5b4fc" }}
        >
          ₹{fill.cost_inr}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3 text-[13px] font-bold" style={{ color: "#a1a1aa" }}>
        <span>{Math.round(fill.kcal)} kcal</span>
        <span style={{ color: "#60a5fa" }}>P {fill.protein_g.toFixed(1)}g</span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "#a1a1aa" }}>{fill.text}</p>
    </motion.div>
  );
}

function LoadingSkeleton({ message = "", isScanning = false }: { message?: string, isScanning?: boolean }) {
  if (isScanning) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="flex flex-col items-center justify-center space-y-10 py-20"
      >
        <div className="relative w-72 h-72 rounded-[2rem] overflow-hidden" style={{ boxShadow: "0 0 0 1px rgba(245,158,11,0.2), 0 20px 40px -10px rgba(245,158,11,0.2)" }}>
          <Image src="/images/ai_scanner.png" alt="AI Scanner" fill sizes="288px" priority className="object-cover opacity-90" />
          <div className="absolute inset-0 border-[6px] border-accent rounded-[2rem] opacity-30" />
          <motion.div 
            animate={{ top: ["0%", "100%", "0%"] }}
            transition={{ duration: 3, ease: "linear", repeat: Infinity }}
            className="absolute left-0 right-0 h-1.5 bg-accent shadow-[0_0_20px_rgba(245,158,11,1)]" 
          />
        </div>
        <div className="flex flex-col items-center text-center gap-3">
          <motion.p 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ fontSize: "20px", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}
          >
            {message}
          </motion.p>
          <p style={{ fontSize: "14px", color: "#a1a1aa" }}>Extracting macros via linear programming...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[120px] rounded-3xl bg-white/5" />
        ))}
      </div>
      {[0, 1].map((s) => (
        <div key={s} className="space-y-4">
          <div className="flex items-center gap-3">
             <Skeleton className="h-10 w-10 rounded-2xl bg-white/5" />
             <Skeleton className="h-6 w-32 rounded-lg bg-white/5" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[220px] rounded-3xl bg-white/5" />
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
      <div className="mf-rise mx-auto w-full max-w-6xl flex-1 space-y-8 p-5 sm:p-6 lg:p-8">
        {/* Header section matching new design system */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.04em", color: "#f4f4f5" }}>
              Optimizer
            </h1>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "#a1a1aa", marginTop: "4px" }}>
              {today}
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="flex items-center gap-3">
             <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleScanPhoto}
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || isScanning}
                className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-40"
                style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}
              >
                <HugeiconsIcon icon={isScanning ? RefreshIcon : Camera02Icon} className={cn("h-4 w-4", isScanning && "animate-spin")} />
                {isScanning ? "Scanning..." : "AI Photo Scan"}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={fetchPlate}
                disabled={loading || isScanning}
                className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-40 hover:bg-white/5"
                style={{ background: "rgba(255,255,255,0.03)", color: "#f4f4f5", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <HugeiconsIcon icon={RefreshIcon} className={cn("h-4 w-4", loading && "animate-spin")} />
                Re-roll
              </motion.button>
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {loading || isScanning ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingSkeleton isScanning={isScanning} message={isScanning ? "Analyzing mess menu items..." : ""} />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
               <ErrorState error={error} />
            </motion.div>
          ) : result ? (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
               <PlateView result={result} />
            </motion.div>
          ) : null}
        </AnimatePresence>
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
        }
        .label-caps {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
      `}</style>
    </DashboardShell>
  );
}

// ── error state ──────────────────────────────────────────────────────────

function ErrorState({ error }: { error: { message: string; status?: number } }) {
  const isOnboarding = error.status === 409;
  return (
    <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
        <HugeiconsIcon icon={Alert01Icon} size={32} />
      </div>
      <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#f4f4f5", marginBottom: "8px" }}>
        {isOnboarding ? "Onboarding required" : "Solver Error"}
      </h2>
      <p style={{ fontSize: "15px", color: "#a1a1aa", maxWidth: "400px", marginBottom: "24px" }}>
        {error.message}
      </p>
      {isOnboarding && (
        <Link href="/onboarding/hostel" className="rounded-full px-6 py-3 text-sm font-bold transition-all hover:scale-[1.02] active:scale-95" style={{ background: "#f59e0b", color: "#1b1304" }}>
          Complete onboarding
        </Link>
      )}
    </div>
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
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="space-y-10">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        <motion.div variants={itemVariants}><MacroCard label="Kcal" current={totals.kcal} target={targets.kcal} unit=" kcal" barColor="#f59e0b" /></motion.div>
        <motion.div variants={itemVariants}><MacroCard label="Protein" current={totals.protein_g} target={targets.protein_g} unit="g" barColor="#60a5fa" /></motion.div>
        <motion.div variants={itemVariants}><MacroCard label="Carbs" current={totals.carbs_g} target={targets.carbs_g} unit="g" barColor="#fbbf24" /></motion.div>
        <motion.div variants={itemVariants}><MacroCard label="Fats" current={totals.fats_g} target={targets.fats_g} unit="g" barColor="#f87171" /></motion.div>
      </motion.div>

      {solver_status && (
        <div className="flex justify-end">
          <p className="label-caps" style={{ color: "#71717a", fontSize: "10px" }}>
            Solver: {solver_status} · {solve_time_ms}ms
          </p>
        </div>
      )}

      {mealsInPlan.length === 0 ? (
        <EmptyState
          title="No dishes in plan"
          description="The solver returned an empty plate. Try refreshing or check your mess menu."
        />
      ) : (
        <div className="space-y-10">
          {mealsInPlan.map((meal) => (
            <MealSection key={meal} meal={meal} items={plan[meal]} />
          ))}
        </div>
      )}

      {gap_fills.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{ background: "rgba(129,140,248,0.1)", color: "#a5b4fc", border: "1px solid rgba(129,140,248,0.2)" }}
            >
              <HugeiconsIcon icon={ShoppingBag01Icon} className="h-5 w-5" />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#f4f4f5" }}>Canteen Add-ons</h3>
          </div>
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {gap_fills.map((fill) => (
              <motion.div key={fill.item_id} variants={itemVariants}>
                 <GapFillCard fill={fill} />
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}
    </div>
  );
}
