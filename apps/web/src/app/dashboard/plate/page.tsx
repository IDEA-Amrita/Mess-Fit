"use client";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Sun01Icon, Coffee01Icon, Moon01Icon, RefreshIcon, ShoppingBag01Icon, Tick01Icon, Camera02Icon } from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { DashboardShell } from "@/components/DashboardShell";
import { PortionIcon } from "@/components/PortionIcon";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { ProgressRing } from "@/components/motion/progress-ring";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { spring } from "@/lib/motion";
import {
  optimizeToday,
  optimizeFromPhoto,
  type OptimizationResult,
  type PlateItem,
  type GapFill,
} from "@/lib/optimizer-api";
import { getTodayLogs, logMeal, todayIso, type MealType } from "@/lib/tracking-api";
import { submitDishFeedback } from "@/lib/mess-api";
import { track } from "@/lib/analytics";
import { toast } from "@/lib/toast-store";
import { ApiError, apiErrorMessage } from "@/lib/api";
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

type Totals = { kcal: number; protein_g: number; carbs_g: number; fats_g: number };

function MacroRow({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  // >5% over target reads as a warning; a small overshoot is normal rounding noise.
  const over = current > target * 1.05;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label-caps">{label}</span>
        <span className="text-[12px] font-bold tabular-nums text-muted-foreground">
          <AnimatedNumber value={current} className={cn("text-[15px] font-black", over ? "text-[#FF3B30]" : "text-white")} />
          {" / "}
          {Math.round(target)}g
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ ...spring.soft, delay: 0.3 }}
          className="h-full rounded-full"
          style={{ backgroundColor: over ? "#FF3B30" : color }}
        />
      </div>
    </div>
  );
}

/** Hero card: calorie ring on the left, the three macros on the right. */
function DaySummary({ totals, targets }: { totals: Totals; targets: Totals }) {
  const kcalPct = targets.kcal > 0 ? (totals.kcal / targets.kcal) * 100 : 0;
  return (
    <div className="surface-card flex flex-col items-center gap-8 sm:flex-row">
      <ProgressRing
        pct={kcalPct}
        size={148}
        label={`${Math.round(kcalPct)}% of your ${Math.round(targets.kcal)} kcal target`}
      >
        <AnimatedNumber value={totals.kcal} className="text-2xl font-black tabular-nums text-white" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          of {Math.round(targets.kcal).toLocaleString()} kcal
        </span>
      </ProgressRing>
      <div className="w-full flex-1 space-y-4">
        <MacroRow label="Protein" current={totals.protein_g} target={targets.protein_g} color="var(--accent)" />
        <MacroRow label="Carbs" current={totals.carbs_g} target={targets.carbs_g} color="#64D2FF" />
        <MacroRow label="Fats" current={totals.fats_g} target={targets.fats_g} color="#FF9F0A" />
      </div>
    </div>
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
    <motion.div whileHover={{ y: -2 }} transition={spring.snappy} className="surface-card group flex flex-col p-5">
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

function MealSection({ meal, items, logged }: { meal: string; items: PlateItem[]; logged: boolean }) {
  const meta = getMealMeta(meal);
  const mealKcal = items.reduce((s, d) => s + d.kcal, 0);
  const qc = useQueryClient();

  const logMutation = useMutation({
    mutationFn: logMeal,
    onSuccess: () => {
      const label = meal.charAt(0).toUpperCase() + meal.slice(1);
      toast.success(`${label} logged ✓`);
      track("meal_logged", { meal, via: "plate" });
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
        {/* Logging is an upsert per (user, date, meal), so a logged meal stays
            tappable - re-logging just overwrites it. */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleLogAsPlanned}
          disabled={logMutation.isPending}
          aria-label={logged ? `${meta.label} logged - tap to log again as planned` : `Log ${meta.label} as planned`}
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-colors disabled:opacity-40",
            logged ? "border border-accent/40 bg-accent/10 text-accent" : "bg-accent text-black",
          )}
        >
          <motion.span
            key={logged ? "done" : "todo"}
            initial={{ scale: logged ? 0.3 : 1, rotate: logged ? -30 : 0 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={spring.snappy}
            className="flex"
          >
            <HugeiconsIcon icon={Tick01Icon} className="h-4 w-4" />
          </motion.span>
          {logMutation.isPending ? "Logging" : logged ? "Logged" : "Log"}
        </motion.button>
      </div>

      <Stagger onMount gap={0.05} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <StaggerItem key={item.dish_id}>
            <DishCard item={item} meal={meal} />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function GapFillCard({ fill }: { fill: GapFill }) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={spring.snappy} className="surface-card flex flex-col p-5">
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
    <div className="mt-6 space-y-10" aria-busy="true" aria-label="Building your plate">
      <Skeleton className="h-[204px] rounded-[1.5rem] sm:h-[148px]" />
      {[3, 2].map((count, i) => (
        <div key={i} className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: count }, (_, j) => (
              <Skeleton key={j} className="h-44 rounded-[1.5rem]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlateError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const needsOnboarding = error instanceof ApiError && error.status === 409;
  return (
    <div className="mt-6">
      <ErrorState
        title={needsOnboarding ? "Finish setup first" : "Couldn't build your plate"}
        error={error}
        description={needsOnboarding && error instanceof ApiError ? error.detail : undefined}
        onRetry={needsOnboarding ? undefined : onRetry}
        action={
          needsOnboarding ? (
            <Link href="/onboarding/hostel" className="rounded-full bg-accent px-6 py-3 text-[12px] font-black uppercase tracking-widest text-black">
              Set up profile
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}

function PlateView({ result, onReroll }: { result: OptimizationResult; onReroll: () => void }) {
  const { plan, daily_totals: totals, daily_targets: targets, gap_fills } = result;
  const mealsInPlan = MEAL_ORDER.filter((m) => (plan[m]?.length ?? 0) > 0);

  // Same query key the dashboard uses, so this is usually a cache hit.
  const todayLogs = useQuery({ queryKey: ["logs", "today"], queryFn: getTodayLogs, retry: 1 });
  const loggedMeals = new Set(todayLogs.data?.meals?.map((m) => m.meal_type) ?? []);

  return (
    <div className="space-y-10 mt-6">
      <DaySummary totals={totals} targets={targets} />

      {mealsInPlan.length === 0 ? (
        <EmptyState
          title="No plate for today"
          description="We couldn't fit any dishes from today's menu to your targets. Try Re-roll, or check that your mess has published a menu."
          action={
            <button onClick={onReroll} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-foreground hover:bg-white/15">
              Re-roll
            </button>
          }
        />
      ) : (
        <div className="space-y-8">
          {mealsInPlan.map((meal) => <MealSection key={meal} meal={meal} items={plan[meal]} logged={loggedMeals.has(meal as MealType)} />)}
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
          <Stagger onMount gap={0.08} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {gap_fills.map((fill) => <StaggerItem key={fill.item_id}><GapFillCard fill={fill} /></StaggerItem>)}
          </Stagger>
        </section>
      )}
    </div>
  );
}

export default function PlatePage() {
  // Same key the dashboard and Quick Mode use: arriving from either shows the
  // cached plate immediately instead of a skeleton, and a re-roll here is seen
  // by both.
  const plate = useQuery<OptimizationResult, ApiError>({
    queryKey: ["plate", "today"],
    queryFn: optimizeToday,
    retry: 0,
    staleTime: 0,
  });
  // A photo-scan plan is shown in place of today's plan until the next re-roll.
  const [scanned, setScanned] = useState<OptimizationResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const result = scanned ?? plate.data ?? null;
  const loading = plate.isLoading || rerolling;
  const showError = plate.isError && !scanned;

  // Once per source per visit, not on every re-roll or background refetch.
  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!result) return;
    const source = scanned ? "photo" : "today";
    if (viewedRef.current === source) return;
    viewedRef.current = source;
    track("plate_viewed", { source });
  }, [result, scanned]);

  const reroll = useCallback(async () => {
    setScanned(null);
    setRerolling(true);
    try {
      await plate.refetch();
    } finally {
      setRerolling(false);
    }
  }, [plate]);

  const handleScanPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
      setScanned(await optimizeFromPhoto(file));
      toast.success("Photo scanned!");
    } catch (err) {
      // A failed scan shouldn't throw away the plan already on screen.
      toast.error(apiErrorMessage(err, "Couldn't scan that photo. Try a clearer one."));
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
                onClick={reroll}
                disabled={loading || isScanning}
                className="flex items-center gap-2 rounded-full bg-surface-2 px-5 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-border disabled:opacity-50"
              >
                <HugeiconsIcon icon={RefreshIcon} className={cn("h-4 w-4", (loading || plate.isFetching) && "animate-spin")} />
                Re-roll
              </motion.button>
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {loading || isScanning ? <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><LoadingSkeleton isScanning={isScanning} message="Analyzing meal..." /></motion.div>
          : showError ? <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}><PlateError error={plate.error} onRetry={reroll} /></motion.div>
          : result ? <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><PlateView result={result} onReroll={reroll} /></motion.div>
          : null}
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
}
