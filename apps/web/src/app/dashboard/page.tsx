"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlateIcon, Target01Icon, CheckListIcon, Dumbbell01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useUser } from "@/hooks/use-user";
import { DashboardShell } from "@/components/DashboardShell";
import { PageHeader } from "@/components/ui/page-header";
import { getTodayLogs } from "@/lib/tracking-api";
import { optimizeToday, type OptimizationResult } from "@/lib/optimizer-api";

export default function DashboardPage() {
  const { data: user } = useUser();
  const displayName = user?.user_metadata?.display_name as string | undefined;

  // Fetch today's logs (meals logged, weight, etc.)
  const todayLogs = useQuery({
    queryKey: ["logs", "today"],
    queryFn: getTodayLogs,
    retry: 1,
    staleTime: 0,
  });

  // Fetch today's plate (for planned kcal/protein totals)
  const plate = useQuery<OptimizationResult>({
    queryKey: ["plate", "today"],
    queryFn: optimizeToday,
    retry: 0,
    staleTime: 0,
  });

  // Compute stat values from real data
  const plannedKcal = plate.data?.daily_totals?.kcal;
  const plannedProtein = plate.data?.daily_totals?.protein_g;
  const mealsLogged = todayLogs.data?.meals?.length ?? 0;

  const firstName = displayName?.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-5 sm:p-6 lg:p-8">
        <PageHeader title={`Good ${timeOfDay()}, ${firstName} 👋`} description={today} />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          
          {/* Main Plate Card - Bento Style */}
          <Link href="/dashboard/plate" className="bento-card group col-span-1 md:col-span-2 lg:col-span-2 min-h-[260px] p-6 flex flex-col justify-between">
            <div className="absolute inset-0 z-0">
               <Image src="/images/plate_texture.png" alt="Plate background" fill sizes="(max-width: 768px) 100vw, 66vw" priority className="object-cover opacity-40 mix-blend-overlay transition-transform duration-700 group-hover:scale-105" />
               <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
            </div>
            
            <div className="relative z-10 flex justify-between items-start">
              <div className="flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1.5 text-xs font-bold text-accent backdrop-blur-md">
                <HugeiconsIcon icon={PlateIcon} size={16} />
                <span>Today&apos;s Menu</span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors group-hover:bg-accent group-hover:text-black">
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              </div>
            </div>

            <div className="relative z-10 mt-auto">
              <h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">
                {plate.isLoading ? "Loading your plate..." : "Your optimal plate is ready."}
              </h2>
              <p className="mt-2 text-muted-foreground font-medium max-w-sm">
                AI has analyzed today&apos;s mess menu and built a personalized meal plan to hit your targets.
              </p>
            </div>
          </Link>

          {/* Quick Stats - Calories */}
          <div className="bento-card col-span-1 p-6 flex flex-col justify-between min-h-[260px]">
             <div className="relative z-10">
               <div className="flex items-center justify-between mb-4">
                 <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Calories</span>
                 <HugeiconsIcon icon={Target01Icon} size={20} className="text-accent" />
               </div>
               <div className="flex items-baseline gap-2">
                 <span className="text-5xl font-black tracking-tighter text-foreground">
                   {plannedKcal != null ? Math.round(plannedKcal) : "—"}
                 </span>
                 <span className="text-lg font-medium text-muted-foreground">kcal</span>
               </div>
             </div>
             <div className="relative z-10 mt-6 h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-accent transition-all duration-1000 w-3/4" />
             </div>
          </div>

          {/* Quick Stats - Protein */}
          <div className="bento-card col-span-1 p-6 flex flex-col justify-between min-h-[200px]">
             <div className="relative z-10">
               <div className="flex items-center justify-between mb-4">
                 <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Protein</span>
                 <HugeiconsIcon icon={PlateIcon} size={20} className="text-blue-400" />
               </div>
               <div className="flex items-baseline gap-2">
                 <span className="text-4xl font-bold tracking-tight text-foreground">
                   {plannedProtein != null ? Math.round(plannedProtein) : "—"}
                 </span>
                 <span className="text-base font-medium text-muted-foreground">g</span>
               </div>
             </div>
          </div>

          {/* Workout Card */}
          <Link href="/dashboard/workout" className="bento-card group col-span-1 md:col-span-2 lg:col-span-2 p-6 flex flex-col justify-between min-h-[200px]">
            <div className="absolute inset-0 z-0">
               <Image src="/images/workout_texture.png" alt="Workout background" fill sizes="(max-width: 768px) 100vw, 66vw" className="object-cover opacity-30 mix-blend-overlay transition-transform duration-700 group-hover:scale-105" />
               <div className="absolute inset-0 bg-gradient-to-r from-background/90 to-transparent" />
            </div>
            
            <div className="relative z-10 flex justify-between items-start">
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                <HugeiconsIcon icon={Dumbbell01Icon} size={16} />
                <span>Training</span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors group-hover:bg-white group-hover:text-black">
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              </div>
            </div>

            <div className="relative z-10 mt-auto">
              <h3 className="text-2xl font-bold text-white drop-shadow-md">Today&apos;s Workout</h3>
              <p className="mt-1 text-sm text-muted-foreground">Log your sets and track your progress.</p>
            </div>
          </Link>

        </div>
      </div>
    </DashboardShell>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
