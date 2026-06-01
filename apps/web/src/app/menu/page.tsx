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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sunrise, Sun, Coffee, Moon, Flame, MapPin, EyeOff, Eye } from "lucide-react";

const getMealIcon = (title: string) => {
  switch (title.toLowerCase()) {
    case "breakfast": return <Sunrise className="w-5 h-5 text-amber-500" />;
    case "lunch": return <Sun className="w-5 h-5 text-yellow-500" />;
    case "snack": return <Coffee className="w-5 h-5 text-orange-400" />;
    case "dinner": return <Moon className="w-5 h-5 text-indigo-400" />;
    default: return null;
  }
};

const getCategoryColor = (category: string) => {
  const cat = category.toLowerCase();
  if (["protein", "dal"].includes(cat)) return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  if (["rice", "roti"].includes(cat)) return "bg-orange-500/10 text-orange-500 border-orange-500/20";
  if (["curry", "sabzi"].includes(cat)) return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  if (["sweet", "snack"].includes(cat)) return "bg-pink-500/10 text-pink-500 border-pink-500/20";
  return "bg-slate-500/10 text-slate-400 border-slate-500/20";
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
      <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 shadow-inner">
            {getMealIcon(title)}
          </div>
          <h3 className="text-xl font-bold tracking-tight text-white capitalize">{title}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => {
            const key = exclusionKey(dateStr, mealType, item.dish.id);
            const isExcluded = excludedKeys.has(key);
            const isTogglingThis = toggling === key;
            return (
              <Card
                key={item.id}
                className={`group relative overflow-hidden backdrop-blur-xl border-white/10 transition-all duration-300 ${
                  isExcluded
                    ? "bg-zinc-900/60 opacity-50 grayscale"
                    : "bg-background/40 hover:border-white/20 hover:shadow-[0_0_30px_-10px_rgba(255,255,255,0.1)] hover:scale-[1.02]"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle
                      className={`text-lg font-semibold leading-tight ${isExcluded ? "line-through text-zinc-500" : "text-zinc-100"}`}
                    >
                      {item.dish.name}
                    </CardTitle>
                    <Badge variant="outline" className={`capitalize transition-colors ${getCategoryColor(item.dish.category)}`}>
                      {item.dish.category}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-orange-100/70">{item.dish.kcal} kcal</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-xs font-medium text-zinc-400 bg-black/20 rounded-lg p-2.5 mb-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      {item.dish.protein_g}g P
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      {item.dish.carbs_g}g C
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                      {item.dish.fats_g}g F
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-zinc-500">
                    <span>Serving: {item.dish.default_serving_grams}g ({item.dish.default_serving_unit})</span>
                    {item.availability !== "always" && (
                      <Badge variant="secondary" className="capitalize text-[10px] bg-white/5 hover:bg-white/10 text-zinc-300">
                        {item.availability}
                      </Badge>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggleExclusion(dateStr, mealType, item.dish.id)}
                    disabled={isTogglingThis}
                    className={`mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all disabled:opacity-40 ${
                      isExcluded
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                        : "bg-white/5 text-zinc-500 border border-white/8 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                    }`}
                  >
                    {isExcluded ? (
                      <><Eye className="w-3 h-3" /> Mark available</>
                    ) : (
                      <><EyeOff className="w-3 h-3" /> Not available today</>
                    )}
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayMenu = (menu: DailyMenuResponse | null, dateStr: string) => {
    if (loading) {
      return (
        <div className="space-y-10 mt-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl bg-white/5" />
            <Skeleton className="h-7 w-32 rounded-lg bg-white/5" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-[180px] rounded-2xl bg-white/5 border border-white/5" />
            ))}
          </div>
        </div>
      );
    }

    if (!menu) return <div className="py-12 text-center text-zinc-500 font-medium">Failed to load menu.</div>;

    const hasAny = menu.breakfast.length > 0 || menu.lunch.length > 0 || menu.snack.length > 0 || menu.dinner.length > 0;
    if (!hasAny) return (
      <div className="py-20 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
          <PlateIcon className="w-8 h-8 text-zinc-600" />
        </div>
        <p className="text-zinc-400 font-medium text-lg">No menu items found for this day.</p>
        <p className="text-zinc-600 text-sm mt-1">Check back later or select a different day.</p>
      </div>
    );

    return (
      <div className="mt-8">
        {renderMeal("Breakfast", menu.breakfast, dateStr)}
        {renderMeal("Lunch", menu.lunch, dateStr)}
        {renderMeal("Snack", menu.snack, dateStr)}
        {renderMeal("Dinner", menu.dinner, dateStr)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Decorative ambient background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="container max-w-6xl py-12 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="flex flex-col gap-3">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
              Mess Menu
            </h1>
            <p className="text-zinc-400 text-lg">Discover what's cooking today.</p>
          </div>
          
          {messes.length > 0 && (
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-2 pl-4 shadow-lg shadow-black/50">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <select 
                className="bg-transparent text-white font-medium text-sm focus:outline-none appearance-none cursor-pointer py-1 pr-6"
                value={selectedMessId || ""}
                onChange={(e) => setSelectedMessId(e.target.value)}
              >
                {messes.map(m => (
                  <option key={m.id} value={m.id} className="bg-zinc-900">{m.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <Tabs defaultValue="today" className="w-full">
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl w-full max-w-[400px] h-12 shadow-inner">
            <TabsTrigger 
              value="today" 
              className="rounded-lg h-full text-zinc-400 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all font-medium"
            >
              Today
            </TabsTrigger>
            <TabsTrigger 
              value="tomorrow"
              className="rounded-lg h-full text-zinc-400 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all font-medium"
            >
              Tomorrow
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="today" className="outline-none focus:outline-none">
            {renderDayMenu(todayMenu, todayStr)}
          </TabsContent>
          <TabsContent value="tomorrow" className="outline-none focus:outline-none">
            {renderDayMenu(tomorrowMenu, tomorrowStr)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Fallback icon
function PlateIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}
