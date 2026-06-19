"use client";

import { useCallback, useEffect, useState } from "react";
import { format, addDays } from "date-fns";
import {
  DailyMenuResponse,
  DishExclusion,
  excludeDish,
  getExclusions,
  getDailyMenu,
  getMesses,
  Mess,
  unexcludeDish,
} from "@/lib/mess-api";
import { DashboardShell } from "@/components/DashboardShell";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sun01Icon, Coffee01Icon, Moon01Icon, FireIcon, Location01Icon, ViewOffIcon, ViewIcon, Restaurant01Icon } from "@hugeicons/core-free-icons";

const getMealIcon = (title: string) => {
  switch (title.toLowerCase()) {
    case "breakfast": return <Sun01Icon className="h-5 w-5 text-amber-400" />;
    case "lunch": return <Sun01Icon className="h-5 w-5 text-yellow-400" />;
    case "snack": return <Coffee01Icon className="h-5 w-5 text-orange-400" />;
    case "dinner": return <Moon01Icon className="h-5 w-5 text-indigo-400" />;
    default: return null;
  }
};

const getCategoryColor = (category: string) => {
  const cat = category.toLowerCase();
  if (["protein", "dal"].includes(cat)) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (["rice", "roti"].includes(cat)) return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  if (["curry", "sabzi"].includes(cat)) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (["sweet", "snack"].includes(cat)) return "bg-pink-500/10 text-pink-400 border-pink-500/20";
  return "bg-white/5 text-muted-foreground border-border";
};

// exclusionKey uniquely identifies an exclusion: date|meal_type|dish_id
function exclusionKey(date: string, mealType: string, dishId: string): string {
  return `${date}|${mealType}|${dishId}`;
}

export default function MenuPage() {
  const [messes, setMesses] = useState<Mess[]>([]);
  const [selectedMessId, setSelectedMessId] = useState<string | null>(null);

  const [todayMenu, setTodayMenu] = useState<DailyMenuResponse | null>(null);
  const [tomorrowMenu, setTomorrowMenu] = useState<DailyMenuResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Set of exclusionKey strings for fast O(1) lookup in render
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<string | null>(null); // key of dish being toggled

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");

  useEffect(() => {
    async function loadMesses() {
      try {
        const data = await getMesses();
        setMesses(data);
        if (data.length > 0) {
          const cbBoys = data.find(m => m.name === "Amrita CB Boys A");
          setSelectedMessId(cbBoys ? cbBoys.id : data[0].id);
        }
      } catch (err) {
        console.error("Failed to load messes:", err);
      }
    }
    loadMesses();
  }, []);

  useEffect(() => {
    async function loadMenus() {
      if (!selectedMessId) return;
      setLoading(true);
      try {
        const [today, tomorrow, todayExcl, tomorrowExcl] = await Promise.all([
          getDailyMenu(selectedMessId, todayStr),
          getDailyMenu(selectedMessId, tomorrowStr),
          getExclusions(todayStr),
          getExclusions(tomorrowStr),
        ]);

        setTodayMenu(today);
        setTomorrowMenu(tomorrow);

        const keys = new Set<string>();
        [...todayExcl, ...tomorrowExcl].forEach((e: DishExclusion) =>
          keys.add(exclusionKey(e.date, e.meal_type, e.dish_id))
        );
        setExcludedKeys(keys);
      } catch (err) {
        console.error("Failed to load menus:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMenus();
  }, [selectedMessId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleExclusion = useCallback(
    async (dateStr: string, mealType: string, dishId: string) => {
      const key = exclusionKey(dateStr, mealType, dishId);
      setToggling(key);
      try {
        if (excludedKeys.has(key)) {
          await unexcludeDish(dishId, dateStr, mealType);
          setExcludedKeys(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        } else {
          await excludeDish({ date: dateStr, meal_type: mealType, dish_id: dishId });
          setExcludedKeys(prev => new Set(prev).add(key));
        }
      } catch (err) {
        console.error("Failed to toggle exclusion:", err);
      } finally {
        setToggling(null);
      }
    },
    [excludedKeys]
  );

  const renderMeal = (title: string, items: any[], dateStr: string) => {
    if (!items || items.length === 0) return null;
    const mealType = title.toLowerCase();
    return (
      <div className="mf-rise mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl border border-border bg-surface-2 p-2">
            {getMealIcon(title)}
          </div>
          <h3 className="text-h2 capitalize text-foreground">{title}</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const key = exclusionKey(dateStr, mealType, item.dish.id);
            const isExcluded = excludedKeys.has(key);
            const isTogglingThis = toggling === key;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border bg-card p-5 transition-all ${
                  isExcluded
                    ? "border-border opacity-50 grayscale"
                    : "border-border hover:border-border-strong hover:shadow-md"
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p
                    className={`text-base font-semibold leading-tight ${
                      isExcluded ? "text-muted-foreground line-through" : "text-foreground"
                    }`}
                  >
                    {item.dish.name}
                  </p>
                  <Badge variant="outline" className={`capitalize ${getCategoryColor(item.dish.category)}`}>
                    {item.dish.category}
                  </Badge>
                </div>

                <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <FireIcon className="h-3.5 w-3.5 text-accent" />
                  <span>{item.dish.kcal} kcal</span>
                </div>

                <div className="mb-3 flex items-center gap-4 rounded-lg bg-black/20 p-2.5 text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    {item.dish.protein_g}g P
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    {item.dish.carbs_g}g C
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    {item.dish.fats_g}g F
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                  <span>Serving: {item.dish.default_serving_grams}g ({item.dish.default_serving_unit})</span>
                  {item.availability !== "always" && (
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {item.availability}
                    </Badge>
                  )}
                </div>

                <button
                  onClick={() => handleToggleExclusion(dateStr, mealType, item.dish.id)}
                  disabled={isTogglingThis}
                  className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-all disabled:opacity-40 ${
                    isExcluded
                      ? "border-success/20 bg-success/10 text-success hover:bg-success/20"
                      : "border-border bg-surface-2 text-muted-foreground hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                  }`}
                >
                  {isExcluded ? (
                    <><ViewIcon className="h-3 w-3" /> Mark available</>
                  ) : (
                    <><ViewOffIcon className="h-3 w-3" /> Not available today</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayMenu = (menu: DailyMenuResponse | null, dateStr: string) => {
    if (loading) {
      return (
        <div className="mt-6 space-y-10">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-7 w-32 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-45 rounded-2xl" />
            ))}
          </div>
        </div>
      );
    }

    if (!menu) {
      return (
        <EmptyState
          className="mt-8"
          icon={<Restaurant01Icon className="h-6 w-6" />}
          title="Failed to load menu"
          description="Something went wrong fetching this day's menu. Try again shortly."
        />
      );
    }

    const hasAny = menu.breakfast.length > 0 || menu.lunch.length > 0 || menu.snack.length > 0 || menu.dinner.length > 0;
    if (!hasAny) {
      return (
        <EmptyState
          className="mt-8"
          icon={<Restaurant01Icon className="h-6 w-6" />}
          title="No menu items for this day"
          description="Check back later or pick a different day."
        />
      );
    }

    return (
      <div className="mt-8">
        {renderMeal("Breakfast", menu.breakfast, dateStr)}
        {renderMeal("Lunch", menu.lunch, dateStr)}
        {renderMeal("Snack", menu.snack, dateStr)}
        {renderMeal("Dinner", menu.dinner, dateStr)}
      </div>
    );
  };

  const messSelector =
    messes.length > 0 ? (
      <label className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm">
        <Location01Icon className="h-4 w-4 text-accent" />
        <select
          className="scheme-dark cursor-pointer appearance-none bg-transparent font-medium text-foreground outline-none"
          value={selectedMessId || ""}
          onChange={(e) => setSelectedMessId(e.target.value)}
          aria-label="Select mess"
        >
          {messes.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
    ) : null;

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        <PageHeader
          eyebrow="Mess menu"
          title="What's cooking"
          description="Browse today and tomorrow; hide dishes you won't eat so your plate skips them."
          actions={messSelector}
        />

        <Tabs defaultValue="today" className="mt-8 w-full">
          <TabsList className="h-11 w-full max-w-90">
            <TabsTrigger value="today" className="flex-1">Today</TabsTrigger>
            <TabsTrigger value="tomorrow" className="flex-1">Tomorrow</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="outline-none">
            {renderDayMenu(todayMenu, todayStr)}
          </TabsContent>
          <TabsContent value="tomorrow" className="outline-none">
            {renderDayMenu(tomorrowMenu, tomorrowStr)}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}
