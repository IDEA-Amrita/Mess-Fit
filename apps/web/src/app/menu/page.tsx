"use client";
import { HugeiconsIcon } from "@hugeicons/react";

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
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Sun01Icon, Coffee01Icon, Moon01Icon, FireIcon, Location01Icon, ViewOffIcon, ViewIcon, Restaurant01Icon } from "@hugeicons/core-free-icons";

const getMealIcon = (title: string) => {
  switch (title.toLowerCase()) {
    case "breakfast": return <HugeiconsIcon icon={Sun01Icon} className="h-5 w-5 text-amber-500" />;
    case "lunch": return <HugeiconsIcon icon={Sun01Icon} className="h-5 w-5 text-amber-400" />;
    case "snack": return <HugeiconsIcon icon={Coffee01Icon} className="h-5 w-5 text-orange-500" />;
    case "dinner": return <HugeiconsIcon icon={Moon01Icon} className="h-5 w-5 text-indigo-400" />;
    default: return null;
  }
};

const getCategoryColor = (category: string) => {
  const cat = category.toLowerCase();
  if (["protein", "dal"].includes(cat)) return { bg: "rgba(59,130,246,0.1)", color: "#60a5fa" };
  if (["rice", "roti"].includes(cat)) return { bg: "rgba(249,115,22,0.1)", color: "#fb923c" };
  if (["curry", "sabzi"].includes(cat)) return { bg: "rgba(16,185,129,0.1)", color: "#34d399" };
  if (["sweet", "snack"].includes(cat)) return { bg: "rgba(236,72,153,0.1)", color: "#f472b6" };
  return { bg: "rgba(255,255,255,0.05)", color: "#a1a1aa" };
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
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow">("today");

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
      <div className="mf-rise mb-12">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {getMealIcon(title)}
          </div>
          <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#f4f4f5", letterSpacing: "-0.01em" }}>{title}</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const key = exclusionKey(dateStr, mealType, item.dish.id);
            const isExcluded = excludedKeys.has(key);
            const isTogglingThis = toggling === key;
            const catColors = getCategoryColor(item.dish.category);
            
            return (
              <div
                key={item.id}
                className={`glass-card flex flex-col justify-between p-5 transition-all duration-300 ${
                  isExcluded ? "opacity-50 grayscale scale-[0.98]" : "hover:scale-[1.02]"
                }`}
              >
                <div>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p
                      className={`text-[15px] font-bold leading-tight ${
                        isExcluded ? "text-muted-foreground line-through" : "text-white"
                      }`}
                    >
                      {item.dish.name}
                    </p>
                    <span 
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" 
                      style={{ background: catColors.bg, color: catColors.color }}
                    >
                      {item.dish.category}
                    </span>
                  </div>

                  <div className="mb-4 flex items-center gap-2">
                    <HugeiconsIcon icon={FireIcon} className="h-4 w-4" style={{ color: "#f59e0b" }} />
                    <span className="text-[13px] font-bold" style={{ color: "#e2e2e2" }}>{item.dish.kcal} kcal</span>
                  </div>

                  <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl p-3" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold text-muted-foreground">Pro</span>
                       <span className="text-[12px] font-bold" style={{ color: "#60a5fa" }}>{item.dish.protein_g}g</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold text-muted-foreground">Carb</span>
                       <span className="text-[12px] font-bold" style={{ color: "#fbbf24" }}>{item.dish.carbs_g}g</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold text-muted-foreground">Fat</span>
                       <span className="text-[12px] font-bold" style={{ color: "#f87171" }}>{item.dish.fats_g}g</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
                    <span>{item.dish.default_serving_grams}g ({item.dish.default_serving_unit})</span>
                    {item.availability !== "always" && (
                      <span className="rounded-full px-2 py-0.5" style={{ background: "rgba(255,255,255,0.05)" }}>
                        {item.availability}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleExclusion(dateStr, mealType, item.dish.id)}
                  disabled={isTogglingThis}
                  className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[12px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 ${
                    isExcluded
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
                      : "bg-white/5 text-zinc-400 border border-white/5 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-500"
                  }`}
                >
                  {isExcluded ? (
                    <><HugeiconsIcon icon={ViewIcon} className="h-4 w-4" /> Add back to plate</>
                  ) : (
                    <><HugeiconsIcon icon={ViewOffIcon} className="h-4 w-4" /> Hide from plate</>
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
        <div className="mt-8 space-y-12">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-2xl bg-white/5" />
            <Skeleton className="h-8 w-40 rounded-xl bg-white/5" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-64 rounded-3xl bg-white/5" />
            ))}
          </div>
        </div>
      );
    }

    if (!menu) {
      return (
        <div className="glass-card mt-8 flex flex-col items-center justify-center p-12 text-center" style={{ borderRadius: "1.5rem" }}>
          <HugeiconsIcon icon={Restaurant01Icon} className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#f4f4f5" }}>Failed to load menu</h3>
          <p className="mt-2 text-[14px] text-muted-foreground">Something went wrong fetching this day's menu. Try again shortly.</p>
        </div>
      );
    }

    const hasAny = menu.breakfast.length > 0 || menu.lunch.length > 0 || menu.snack.length > 0 || menu.dinner.length > 0;
    if (!hasAny) {
      return (
        <div className="glass-card mt-8 flex flex-col items-center justify-center p-12 text-center" style={{ borderRadius: "1.5rem" }}>
          <HugeiconsIcon icon={Restaurant01Icon} className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#f4f4f5" }}>No menu items for this day</h3>
          <p className="mt-2 text-[14px] text-muted-foreground">Check back later or pick a different day.</p>
        </div>
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
      <label className="flex items-center gap-2 rounded-xl px-4 py-3 text-[14px] font-bold" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e2e2" }}>
        <HugeiconsIcon icon={Location01Icon} className="h-5 w-5" style={{ color: "#f59e0b" }} />
        <select
          className="scheme-dark cursor-pointer appearance-none bg-transparent outline-none pr-4"
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
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-6 lg:p-8">
        
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <p className="label-caps mb-2" style={{ color: "#f59e0b" }}>Mess Menu</p>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.04em", color: "#f4f4f5" }}>
              What&apos;s Cooking
            </h1>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "#a1a1aa", marginTop: "8px", maxWidth: "400px", lineHeight: 1.6 }}>
              Browse today and tomorrow. Hide dishes you won&apos;t eat so the AI Optimizer skips them.
            </p>
          </div>
          <div>
            {messSelector}
          </div>
        </div>

        <div className="glass-card flex gap-1 p-1 max-w-[400px]" style={{ borderRadius: "16px" }}>
          <button
            onClick={() => setActiveTab("today")}
            className="flex-1 rounded-xl py-3 text-[13px] font-bold transition-all"
            style={activeTab === "today" ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b", boxShadow: "0 0 10px rgba(245,158,11,0.1)" } : { color: "#a1a1aa" }}
          >
            Today
          </button>
          <button
            onClick={() => setActiveTab("tomorrow")}
            className="flex-1 rounded-xl py-3 text-[13px] font-bold transition-all"
            style={activeTab === "tomorrow" ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b", boxShadow: "0 0 10px rgba(245,158,11,0.1)" } : { color: "#a1a1aa" }}
          >
            Tomorrow
          </button>
        </div>

        <div className="mt-8 outline-none">
          {activeTab === "today" ? renderDayMenu(todayMenu, todayStr) : renderDayMenu(tomorrowMenu, tomorrowStr)}
        </div>
      </div>

      <style jsx global>{`
        .glass-card {
          position: relative;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-radius: 1.5rem;
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
