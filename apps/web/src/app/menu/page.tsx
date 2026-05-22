"use client";

import { useEffect, useState } from "react";
import { format, addDays } from "date-fns";
import { DailyMenuResponse, getDailyMenu, getMesses, Mess } from "@/lib/mess-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function MenuPage() {
  const [messes, setMesses] = useState<Mess[]>([]);
  const [selectedMessId, setSelectedMessId] = useState<string | null>(null);
  
  const [todayMenu, setTodayMenu] = useState<DailyMenuResponse | null>(null);
  const [tomorrowMenu, setTomorrowMenu] = useState<DailyMenuResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMesses() {
      try {
        const data = await getMesses();
        setMesses(data);
        if (data.length > 0) {
          // Find "Amrita CB Boys A" or just pick the first one
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
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
        
        const [today, tomorrow] = await Promise.all([
          getDailyMenu(selectedMessId, todayStr),
          getDailyMenu(selectedMessId, tomorrowStr)
        ]);
        
        setTodayMenu(today);
        setTomorrowMenu(tomorrow);
      } catch (err) {
        console.error("Failed to load menus:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMenus();
  }, [selectedMessId]);

  const renderMeal = (title: string, items: any[]) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 capitalize border-b pb-2">{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{item.dish.name}</CardTitle>
                  <Badge variant="outline" className="capitalize">{item.dish.category}</Badge>
                </div>
                <CardDescription>
                  {item.dish.kcal} kcal • {item.dish.protein_g}g P • {item.dish.carbs_g}g C • {item.dish.fats_g}g F
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground flex justify-between items-center">
                <span>Serving: {item.dish.default_serving_grams}g ({item.dish.default_serving_unit})</span>
                {item.availability !== "always" && (
                  <Badge variant="secondary" className="capitalize">{item.availability}</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderDayMenu = (menu: DailyMenuResponse | null) => {
    if (loading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-[20px] w-[100px] rounded-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-[120px] rounded-xl" />)}
          </div>
        </div>
      );
    }

    if (!menu) return <div>Failed to load menu.</div>;

    const hasAny = menu.breakfast.length > 0 || menu.lunch.length > 0 || menu.snack.length > 0 || menu.dinner.length > 0;
    if (!hasAny) return <div className="py-8 text-center text-muted-foreground">No menu items found for this day.</div>;

    return (
      <div className="space-y-2 mt-4">
        {renderMeal("Breakfast", menu.breakfast)}
        {renderMeal("Lunch", menu.lunch)}
        {renderMeal("Snack", menu.snack)}
        {renderMeal("Dinner", menu.dinner)}
      </div>
    );
  };

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Mess Menu</h1>
        <p className="text-muted-foreground">View what's cooking in your mess.</p>
        
        {messes.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm font-medium">Current Mess:</span>
            <select 
              className="bg-transparent border rounded px-2 py-1 text-sm"
              value={selectedMessId || ""}
              onChange={(e) => setSelectedMessId(e.target.value)}
            >
              {messes.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="tomorrow">Tomorrow</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-6">
          {renderDayMenu(todayMenu)}
        </TabsContent>
        <TabsContent value="tomorrow" className="mt-6">
          {renderDayMenu(tomorrowMenu)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
