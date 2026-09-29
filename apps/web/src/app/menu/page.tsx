"use client";

import { useId, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import {
  Coffee01Icon,
  FireIcon,
  Location01Icon,
  Moon01Icon,
  Restaurant01Icon,
  Sun01Icon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";

import { ErrorState } from "@/components/ui/error-state";
import { DashboardShell } from "@/components/DashboardShell";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { apiErrorMessage, apiFetch, ApiError } from "@/lib/api";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  excludeDish,
  getDailyMenu,
  getExclusions,
  getMesses,
  submitDishFeedback,
  unexcludeDish,
  type DailyMenuResponse,
  type Dish,
  type MessMenu,
} from "@/lib/mess-api";
import { toast } from "@/lib/toast-store";

const MEALS = ["breakfast", "lunch", "snack", "dinner"] as const;
type Meal = (typeof MEALS)[number];

const MEAL_META: Record<Meal, { label: string; icon: typeof Sun01Icon }> = {
  breakfast: { label: "Breakfast", icon: Sun01Icon },
  lunch: { label: "Lunch", icon: Sun01Icon },
  snack: { label: "Snack", icon: Coffee01Icon },
  dinner: { label: "Dinner", icon: Moon01Icon },
};

const CATEGORY_COLOR: Record<string, string> = {
  protein: "#60a5fa",
  dal: "#60a5fa",
  rice: "#fb923c",
  roti: "#fb923c",
  curry: "#34d399",
  sabzi: "#34d399",
  sweet: "#f472b6",
  snack: "#f472b6",
};

function categoryColor(category: string): string {
  return CATEGORY_COLOR[category.toLowerCase()] ?? "#a1a1aa";
}

/** `date|meal_type|dish_id` — the natural key of a `DishExclusion` row. */
function exclusionKey(date: string, mealType: string, dishId: string): string {
  return `${date}|${mealType}|${dishId}`;
}


// Shared so a missing result is the same Set every render (memo deps stay stable).
const NO_EXCLUSIONS = new Set<string>();
export default function MenuPage() {
  const queryClient = useQueryClient();
  const [selectedMessId, setSelectedMessId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow">("today");
  const tabLayoutId = useId();

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const messesQuery = useQuery({ queryKey: ["messes"], queryFn: getMesses, staleTime: 600_000 });
  // Reuses Settings' cache key: the mess the user picked in onboarding is the
  // sensible default here, not an arbitrary first-in-list.
  const hostelQuery = useQuery({
    queryKey: ["profile", "hostel"],
    queryFn: () => apiFetch<{ mess_id: string | null }>("/api/v1/profile/hostel-context"),
    retry: false,
  });

  const messId =
    selectedMessId ??
    (messesQuery.data?.some((m) => m.id === hostelQuery.data?.mess_id) ? hostelQuery.data?.mess_id : null) ??
    messesQuery.data?.[0]?.id ??
    null;

  const todayMenuQuery = useQuery({
    queryKey: ["menu", messId, todayStr],
    queryFn: () => getDailyMenu(messId!, todayStr),
    enabled: !!messId,
  });
  const tomorrowMenuQuery = useQuery({
    queryKey: ["menu", messId, tomorrowStr],
    queryFn: () => getDailyMenu(messId!, tomorrowStr),
    enabled: !!messId,
  });
  const exclusionsQuery = useQuery({
    queryKey: ["exclusions", todayStr, tomorrowStr],
    queryFn: async () => {
      const [t, tm] = await Promise.all([getExclusions(todayStr), getExclusions(tomorrowStr)]);
      return new Set([...t, ...tm].map((e) => exclusionKey(e.date, e.meal_type, e.dish_id)));
    },
    // React Query's structural-sharing compares data with Object.keys(), which
    // is always [] for a Set (its entries aren't enumerable own properties) —
    // so it treated every optimistic update as "unchanged" and re-served the
    // stale Set. Sets need this off; plain arrays/objects don't.
    structuralSharing: false,
  });
  const excludedKeys = exclusionsQuery.data ?? NO_EXCLUSIONS;

  const toggleMutation = useMutation({
    mutationFn: async ({ dateStr, mealType, dishId, currentlyExcluded }: { dateStr: string; mealType: string; dishId: string; currentlyExcluded: boolean }) => {
      if (currentlyExcluded) await unexcludeDish(dishId, dateStr, mealType);
      else await excludeDish({ date: dateStr, meal_type: mealType, dish_id: dishId });
      return { dateStr, mealType, dishId, currentlyExcluded };
    },
    // Optimistic: the card should flip the instant you tap it, not after a round trip.
    onMutate: async ({ dateStr, mealType, dishId, currentlyExcluded }) => {
      await queryClient.cancelQueries({ queryKey: ["exclusions", todayStr, tomorrowStr] });
      const previous = queryClient.getQueryData<Set<string>>(["exclusions", todayStr, tomorrowStr]);
      const key = exclusionKey(dateStr, mealType, dishId);
      queryClient.setQueryData<Set<string>>(["exclusions", todayStr, tomorrowStr], (prev) => {
        const next = new Set(prev ?? []);
        if (currentlyExcluded) next.delete(key);
        else next.add(key);
        return next;
      });
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["exclusions", todayStr, tomorrowStr], ctx.previous);
      toast.error(apiErrorMessage(err, "Couldn't update that — try again"));
    },
  });

  const messSelector = (
    <label className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3 text-[14px] font-bold text-foreground">
      <HugeiconsIcon icon={Location01Icon} className="h-5 w-5 text-accent" />
      <select
        className="scheme-dark cursor-pointer appearance-none bg-transparent pr-4 outline-none"
        value={messId ?? ""}
        onChange={(e) => setSelectedMessId(e.target.value)}
        aria-label="Select mess"
        disabled={!messesQuery.data?.length}
      >
        {(messesQuery.data ?? []).map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );

  const activeMenuQuery = activeTab === "today" ? todayMenuQuery : tomorrowMenuQuery;
  const activeDateStr = activeTab === "today" ? todayStr : tomorrowStr;
  const hiddenCount = useMemo(() => {
    const menu = activeMenuQuery.data;
    if (!menu) return 0;
    return MEALS.reduce(
      (n, meal) => n + menu[meal].filter((item) => excludedKeys.has(exclusionKey(activeDateStr, meal, item.dish.id))).length,
      0,
    );
  }, [activeMenuQuery.data, excludedKeys, activeDateStr]);

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-6 lg:p-8">
        <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <PageHeader
            eyebrow="Mess menu"
            title="What's cooking"
            description="Browse today and tomorrow. Hide dishes you won't eat so the AI Optimizer skips them."
          />
          {messSelector}
        </div>

        <div role="tablist" aria-label="Day" className="relative flex max-w-100 gap-1 rounded-2xl border border-border bg-surface-2 p-1">
          {(["today", "tomorrow"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative flex-1 rounded-xl py-3 text-[13px] font-bold capitalize transition-colors",
                activeTab === tab ? "text-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {activeTab === tab && (
                <motion.span
                  layoutId={tabLayoutId}
                  className="absolute inset-0 rounded-xl bg-accent/15 shadow-[0_0_10px_rgba(204,255,0,0.1)]"
                  transition={spring.snappy}
                />
              )}
              <span className="relative">{tab}</span>
            </button>
          ))}
        </div>

        {hiddenCount > 0 && (
          <p className="mt-4 text-xs font-medium text-muted-foreground">
            {hiddenCount} {hiddenCount === 1 ? "dish" : "dishes"} hidden from your plate for {activeTab}.
          </p>
        )}

        <div role="tabpanel" className="mt-8 outline-none">
          <DayMenu
            key={activeTab}
            loading={!messId || activeMenuQuery.isPending}
            error={activeMenuQuery.isError ? activeMenuQuery.error : null}
            onRetry={() => activeMenuQuery.refetch()}
            menu={activeMenuQuery.data ?? null}
            dateStr={activeDateStr}
            isToday={activeTab === "today"}
            excludedKeys={excludedKeys}
            onToggle={(mealType, dishId, currentlyExcluded) =>
              toggleMutation.mutate({ dateStr: activeDateStr, mealType, dishId, currentlyExcluded })
            }
          />
        </div>
      </div>
    </DashboardShell>
  );
}

function DayMenu({
  loading,
  error,
  onRetry,
  menu,
  dateStr,
  isToday,
  excludedKeys,
  onToggle,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  menu: DailyMenuResponse | null;
  dateStr: string;
  isToday: boolean;
  excludedKeys: Set<string>;
  onToggle: (mealType: string, dishId: string, currentlyExcluded: boolean) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-12">
        {[0, 1].map((i) => (
          <div key={i}>
            <div className="mb-6 flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <Skeleton className="h-6 w-32 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((j) => (
                <Skeleton key={j} className="h-64 rounded-3xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    const notSeeded = error instanceof ApiError && error.status === 404;
    if (!notSeeded) return <ErrorState title="Couldn't load the menu" error={error} onRetry={onRetry} />;
    return (
      <EmptyState
        icon={<HugeiconsIcon icon={Restaurant01Icon} className="h-6 w-6" />}
        title="This mess hasn't published a menu yet"
        description="Check back later, or pick a different mess above."
      />
    );
  }

  if (!menu) return null;

  const hasAny = MEALS.some((m) => menu[m].length > 0);
  if (!hasAny) {
    return (
      <EmptyState
        icon={<HugeiconsIcon icon={Restaurant01Icon} className="h-6 w-6" />}
        title="No menu items for this day"
        description="Check back later or pick a different day."
      />
    );
  }

  return (
    <Stagger onMount gap={0.08} className="space-y-12">
      {MEALS.filter((meal) => menu[meal].length > 0).map((meal) => (
        <StaggerItem key={meal}>
          <MealSection
            meal={meal}
            items={menu[meal]}
            dateStr={dateStr}
            isToday={isToday}
            excludedKeys={excludedKeys}
            onToggle={onToggle}
          />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function MealSection({
  meal,
  items,
  dateStr,
  isToday,
  excludedKeys,
  onToggle,
}: {
  meal: Meal;
  items: MessMenu[];
  dateStr: string;
  isToday: boolean;
  excludedKeys: Set<string>;
  onToggle: (mealType: string, dishId: string, currentlyExcluded: boolean) => void;
}) {
  const meta = MEAL_META[meal];
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-2">
          <HugeiconsIcon icon={meta.icon} className="h-5 w-5 text-accent" />
        </div>
        <h2 className="text-[20px] font-extrabold tracking-tight text-foreground">{meta.label}</h2>
      </div>

      <Stagger gap={0.04} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <StaggerItem key={item.id}>
            <DishCard
              item={item}
              meal={meal}
              dateStr={dateStr}
              isToday={isToday}
              excluded={excludedKeys.has(exclusionKey(dateStr, meal, item.dish.id))}
              onToggle={onToggle}
            />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

function DishCard({
  item,
  meal,
  dateStr,
  isToday,
  excluded,
  onToggle,
}: {
  item: MessMenu;
  meal: Meal;
  dateStr: string;
  isToday: boolean;
  excluded: boolean;
  onToggle: (mealType: string, dishId: string, currentlyExcluded: boolean) => void;
}) {
  const dish: Dish = item.dish;
  const color = categoryColor(dish.category);

  const [vote, setVote] = useState<"confirm" | "deny" | null>(null);
  const voteMutation = useMutation({
    mutationFn: (v: "confirm" | "deny") => submitDishFeedback({ date: dateStr, meal_type: meal, dish_id: dish.id, vote: v }),
    onSuccess: (_, v) => {
      setVote(v);
      toast.success("Thanks — that helps the community.");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't submit that")),
  });

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      transition={spring.snappy}
      className={cn(
        "surface-card flex flex-col justify-between p-5 transition-[opacity,filter] duration-300",
        excluded && "opacity-50 grayscale",
      )}
    >
      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className={cn("text-[15px] font-bold leading-tight", excluded ? "text-muted-foreground line-through" : "text-white")}>
            {dish.name}
          </p>
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: `${color}1a`, color }}>
            {dish.category}
          </span>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <HugeiconsIcon icon={FireIcon} className="h-4 w-4 text-accent" />
          <span className="text-[13px] font-bold text-foreground/90">{dish.kcal} kcal</span>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-border bg-black/20 p-3">
          <MacroCell label="Pro" value={dish.protein_g} color="#60a5fa" />
          <MacroCell label="Carb" value={dish.carbs_g} color="#fbbf24" />
          <MacroCell label="Fat" value={dish.fats_g} color="#f87171" />
        </div>

        <div className="mb-4 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>
            {dish.default_serving_grams}g ({dish.default_serving_unit})
          </span>
          {item.availability !== "always" && (
            <span className="rounded-full border border-border px-2 py-0.5 capitalize">{item.availability}</span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => onToggle(meal, dish.id, excluded)}
          aria-pressed={excluded}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-[12px] font-bold uppercase tracking-wider transition-colors",
            excluded
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
              : "border-white/5 bg-white/5 text-zinc-400 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-500",
          )}
        >
          <HugeiconsIcon icon={excluded ? ViewIcon : ViewOffIcon} className="h-4 w-4" />
          {excluded ? "Add back to plate" : "Hide from plate"}
        </button>

        {/* Crowdsourced availability check — only meaningful for the real-time menu. */}
        {isToday && (
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="label-caps">Actually being served?</span>
            <div className="flex gap-1.5">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => voteMutation.mutate("confirm")}
                disabled={vote !== null || voteMutation.isPending}
                aria-pressed={vote === "confirm"}
                aria-label="Confirm this dish is being served"
                className={cn(
                  "flex h-7 items-center justify-center rounded-lg px-3 text-[11px] font-black uppercase tracking-widest transition-colors",
                  vote === "confirm" ? "bg-white text-black" : "bg-surface-2 text-muted-foreground hover:bg-border hover:text-white",
                  vote === "deny" && "opacity-30",
                )}
              >
                Yes
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => voteMutation.mutate("deny")}
                disabled={vote !== null || voteMutation.isPending}
                aria-pressed={vote === "deny"}
                aria-label="Report this dish is not being served"
                className={cn(
                  "flex h-7 items-center justify-center rounded-lg px-3 text-[11px] font-black uppercase tracking-widest transition-colors",
                  vote === "deny" ? "bg-[#FF3B30] text-white" : "bg-surface-2 text-muted-foreground hover:bg-border hover:text-white",
                  vote === "confirm" && "opacity-30",
                )}
              >
                No
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MacroCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
      <span className="text-[12px] font-bold" style={{ color }}>
        {value}g
      </span>
    </div>
  );
}
