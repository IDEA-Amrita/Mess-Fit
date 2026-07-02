"use client";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Sun01Icon, Coffee01Icon, Moon01Icon, RefreshIcon, Alert01Icon, ShoppingBag01Icon, Tick01Icon, Camera02Icon } from "@hugeicons/core-free-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

const MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner"] as const;

function getMealMeta(meal: string) {
  switch (meal) {
    case "breakfast":
      return { icon: <HugeiconsIcon icon={Sun01Icon} className="h-4 w-4" />, color: "#FFFFFF", label: "Breakfast" };
    case "lunch":
      return { icon: <HugeiconsIcon icon={Sun01Icon} className="h-4 w-4" />, color: "#FFFFFF", label: "Lunch" };
    case "snack":
      return { icon: <HugeiconsIcon icon={Coffee01Icon} className="h-4 w-4" />, color: "#FFFFFF", label: "Snack" };
    case "dinner":
      return { icon: <HugeiconsIcon icon={Moon01Icon} className="h-4 w-4" />, color: "#FFFFFF", label: "Dinner" };
    default:
      return { icon: null, color: "var(--text-muted)", label: meal };
  }
}

function MacroCard({ label, current, target, unit, barColor }: { label: string; current: number; target: number; unit: string; barColor: string }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const over = current > target * 1.05;
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="surface-card p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <span className="label-caps">{label}</span>
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black text-white tracking-tighter">
            {Math.round(current)}
          </span>
          <span className="text-xs font-bold text-muted-foreground">/ {Math.round(target)}{unit}</span>
        </div>
        <div className="mt-3 h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 15, delay: 0.2 }}
            className="h-full rounded-full"
            style={{ backgroundColor: over ? "#FF3B30" : barColor }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function DishCard({ item, meal }: { item: PlateItem; meal: string }) {
  const portionsLabel = Number.isInteger(item.portions) ? `${item.portions}×` : `${item.portions.toFixed(1)}×`;
  const [vote, setVote] = useState<"confirm" | "deny" | null>(null);
  
  const voteMutation = useMutation({
    mutationFn: (v: "confirm" | "deny") => submitDishFeedback({ date: todayIso(), meal_type: meal, dish_id: item.dish_id, vote: v }),
    onSuccess: (_, variables) => {
      setVote(variables);
      toast.success("Verified.");
    },
  });

  return (
    <motion.div layout whileHover={{ y: -2 }} className="surface-card group flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] font-bold text-white leading-tight">{item.name}</p>
        <span className="text-[14px] font-black text-accent shrink-0">{Math.round(item.kcal)} kcal</span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
        <PortionIcon icon={item.portion_icon} size={14} color="currentColor" />
        <span>{portionsLabel} {item.serving_unit} · {Math.round(item.grams)}g</span>
      </div>

      <div className="mt-4 flex items-center gap-4 text-[11px] font-bold text-white uppercase tracking-widest">
        <span><span className="text-muted-foreground">P</span> {item.protein_g.toFixed(0)}</span>
        <span><span className="text-muted-foreground">C</span> {item.carbs_g.toFixed(0)}</span>
        <span><span className="text-muted-foreground">F</span> {item.fats_g.toFixed(0)}</span>
      </div>

      {item.reason && <p className="mt-3 text-[12px] font-medium text-muted-foreground leading-relaxed">{item.reason}</p>}

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <span className="label-caps">Served today?</span>
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => voteMutation.mutate("confirm")}
            disabled={vote !== null || voteMutation.isPending}
            className={cn(
              "flex h-8 items-center justify-center rounded-lg px-4 text-[11px] font-black uppercase tracking-widest transition-colors",
              vote === "confirm" ? "bg-white text-black" : "bg-surface-2 text-muted-foreground hover:bg-border hover:text-white",
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
              "flex h-8 items-center justify-center rounded-lg px-4 text-[11px] font-black uppercase tracking-widest transition-colors",
              vote === "deny" ? "bg-[#FF3B30] text-white" : "bg-surface-2 text-muted-foreground hover:bg-border hover:text-white",
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
      toast.success(`${label} logged ✓`);
      qc.invalidateQueries({ queryKey: ["logs", "today"] });
    },
    onError: () => toast.error("Couldn't log"),
  });

  function handleLogAsPlanned() {
    const macros = items.reduce(
      (acc, d) => ({ kcal: acc.kcal + d.kcal, protein_g: acc.protein_g + d.protein_g, carbs_g: acc.carbs_g + d.carbs_g, fats_g: acc.fats_g + d.fats_g }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
    );
    logMutation.mutate({ date: todayIso(), meal_type: meal as MealType, status: "as_planned", ...macros });
  }

  const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const itemVariants: Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-white">
          {meta.icon}
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-white">{meta.label}</h3>
          <span className="text-[12px] font-bold text-muted-foreground">{Math.round(mealKcal)} kcal</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleLogAsPlanned}
          disabled={logMutation.isPending}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[11px] font-black uppercase tracking-widest text-black transition-colors disabled:opacity-40"
        >
          <HugeiconsIcon icon={Tick01Icon} className="h-4 w-4" />
          {logMutation.isPending ? "Logging" : "Log"}
        </motion.button>
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
    <motion.div whileHover={{ y: -2 }} className="surface-card flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[15px] font-bold text-white leading-tight">{fill.name}</p>
        <span className="text-[14px] font-black text-white shrink-0">₹{fill.cost_inr}</span>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11px] font-bold text-white uppercase tracking-widest">
        <span className="text-accent">{Math.round(fill.kcal)} kcal</span>
        <span><span className="text-muted-foreground">P</span> {fill.protein_g.toFixed(0)}</span>
      </div>
      <p className="mt-2 text-[12px] font-medium text-muted-foreground leading-relaxed">{fill.text}</p>
    </motion.div>
  );
}

function LoadingSkeleton({ message = "", isScanning = false }: { message?: string, isScanning?: boolean }) {
  if (isScanning) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-32 space-y-8">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <svg className="animate-spin-slow h-full w-full text-surface-2" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
          <svg className="animate-spin h-full w-full text-accent absolute inset-0" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="70 200" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-center space-y-2">
          <p className="text-[16px] font-bold text-white">{message}</p>
          <p className="text-[13px] font-medium text-muted-foreground">Processing image and extracting macros...</p>
        </div>
      </motion.div>
    );
  }
  return (
    <div className="space-y-8 mt-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0,1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-[1.5rem] bg-surface" />)}
      </div>
      <Skeleton className="h-64 rounded-[1.5rem] bg-surface" />
    </div>
  );
}

function ErrorState({ error }: { error: { message: string; status?: number } }) {
  const isOnboarding = error.status === 409;
  return (
    <div className="surface-card flex flex-col items-center justify-center py-24 text-center mt-6">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#FF3B30]/10 text-[#FF3B30]">
        <HugeiconsIcon icon={Alert01Icon} size={32} />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{isOnboarding ? "Onboarding required" : "Optimizer Error"}</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{error.message}</p>
      {isOnboarding && (
        <Link href="/onboarding/hostel" className="rounded-full bg-accent px-6 py-3 text-[13px] font-black uppercase tracking-widest text-black">
          Setup Profile
        </Link>
      )}
    </div>
  );
}

function PlateView({ result }: { result: OptimizationResult }) {
  const { plan, daily_totals: totals, daily_targets: targets, gap_fills } = result;
  const mealsInPlan = MEAL_ORDER.filter((m) => (plan[m]?.length ?? 0) > 0);
  const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants: Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

  return (
    <div className="space-y-10 mt-6">
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <motion.div variants={itemVariants}><MacroCard label="Calories" current={totals.kcal} target={targets.kcal} unit="" barColor="var(--accent)" /></motion.div>
        <motion.div variants={itemVariants}><MacroCard label="Protein" current={totals.protein_g} target={targets.protein_g} unit="g" barColor="#FFFFFF" /></motion.div>
        <motion.div variants={itemVariants}><MacroCard label="Carbs" current={totals.carbs_g} target={targets.carbs_g} unit="g" barColor="#FFFFFF" /></motion.div>
        <motion.div variants={itemVariants}><MacroCard label="Fats" current={totals.fats_g} target={targets.fats_g} unit="g" barColor="#FFFFFF" /></motion.div>
      </motion.div>

      {mealsInPlan.length === 0 ? (
        <EmptyState title="No dishes in plan" description="The solver returned an empty plate." />
      ) : (
        <div className="space-y-8">
          {mealsInPlan.map((meal) => <MealSection key={meal} meal={meal} items={plan[meal]} />)}
        </div>
      )}

      {gap_fills.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-white">
              <HugeiconsIcon icon={ShoppingBag01Icon} className="h-5 w-5" />
            </div>
            <h3 className="text-[15px] font-bold text-white">Canteen Add-ons</h3>
          </div>
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {gap_fills.map((fill) => <motion.div key={fill.item_id} variants={itemVariants}><GapFillCard fill={fill} /></motion.div>)}
          </motion.div>
        </section>
      )}
    </div>
  );
}

export default function PlatePage() {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPlate = useCallback(async () => {
    setLoading(true); setError(null);
    try { setResult(await optimizeToday()); }
    catch (err) { setError({ message: err instanceof ApiError ? err.detail : "Error", status: err instanceof ApiError ? err.status : undefined }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPlate(); }, [fetchPlate]);

  const handleScanPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true); setError(null);
    try { setResult(await optimizeFromPhoto(file)); toast.success("Photo scanned!"); }
    catch (err) { setError({ message: err instanceof ApiError ? err.detail : "Failed to scan." }); }
    finally { setIsScanning(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-4xl flex-1 p-5 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-[13px] font-bold text-accent uppercase tracking-widest mb-1">Diet</p>
            <h1 className="heading-heavy">Optimizer</h1>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="flex items-center gap-2">
             <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleScanPhoto} />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || isScanning}
                className="flex items-center gap-2 rounded-full bg-surface-2 px-5 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-border disabled:opacity-50"
              >
                <HugeiconsIcon icon={isScanning ? RefreshIcon : Camera02Icon} className={cn("h-4 w-4", isScanning && "animate-spin")} />
                {isScanning ? "Scanning" : "Photo Scan"}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={fetchPlate}
                disabled={loading || isScanning}
                className="flex items-center gap-2 rounded-full bg-surface-2 px-5 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-border disabled:opacity-50"
              >
                <HugeiconsIcon icon={RefreshIcon} className={cn("h-4 w-4", loading && "animate-spin")} />
                Re-roll
              </motion.button>
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {loading || isScanning ? <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><LoadingSkeleton isScanning={isScanning} message="Analyzing meal..." /></motion.div>
          : error ? <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}><ErrorState error={error} /></motion.div>
          : result ? <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><PlateView result={result} /></motion.div>
          : null}
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
}
