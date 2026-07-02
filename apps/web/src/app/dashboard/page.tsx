"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlateIcon,
  Dumbbell01Icon,
  AiChat01Icon,
  Analytics01Icon,
  FireIcon,
  Target01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { motion } from "framer-motion";
import { useUser } from "@/hooks/use-user";
import { DashboardShell } from "@/components/DashboardShell";
import { getTodayLogs } from "@/lib/tracking-api";
import { optimizeToday, type OptimizationResult } from "@/lib/optimizer-api";

export default function DashboardPage() {
  const { data: user } = useUser();
  const displayName = user?.user_metadata?.display_name as string | undefined;

  const todayLogs = useQuery({
    queryKey: ["logs", "today"],
    queryFn: getTodayLogs,
    retry: 1,
    staleTime: 0,
  });

  const plate = useQuery<OptimizationResult>({
    queryKey: ["plate", "today"],
    queryFn: optimizeToday,
    retry: 0,
    staleTime: 0,
  });

  const plannedKcal = plate.data?.daily_totals?.kcal;
  const userTargets = user?.user_metadata?.targets;
  const targetKcal = plate.data?.daily_targets?.kcal ?? userTargets?.daily_kcal ?? 2500;
  const plannedProtein = plate.data?.daily_totals?.protein_g;
  const targetProtein = plate.data?.daily_targets?.protein_g ?? userTargets?.daily_protein_g ?? 120;
  const mealsLogged = todayLogs.data?.meals?.length ?? 0;

  const firstName = displayName?.split(" ")[0] ?? "Athlete";
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

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

  const calPct = plannedKcal ? Math.min((plannedKcal / targetKcal) * 100, 100) : 0;

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-4xl flex-1 p-5 sm:p-6 lg:p-8">
        {/* ── Greeting ── */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-10 mt-4">
          <p className="text-[13px] font-bold text-accent uppercase tracking-widest mb-1">{today}</p>
          <h1 className="heading-heavy">
            Ready, {firstName}.
          </h1>
        </motion.div>

        {/* ── Insights Feed ── */}
        <motion.div 
           variants={containerVariants}
           initial="hidden"
           animate="show"
           className="flex flex-col gap-4"
        >
          {/* HERO: Readiness / Plate Insight */}
          <motion.div variants={itemVariants}>
            <Link href="/dashboard/plate" className="surface-card-hover group flex flex-col md:flex-row gap-8 justify-between relative overflow-hidden">
              <div className="relative z-10 flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <HugeiconsIcon icon={PlateIcon} size={18} className="text-accent" />
                  <span className="label-caps text-accent">Nutrition Plan</span>
                </div>
                <p className="text-2xl font-bold tracking-tight text-white mb-1">
                  {plannedKcal != null ? `${Math.round(plannedKcal).toLocaleString()} kcal` : "Plan not generated"}
                </p>
                <p className="text-sm text-muted-foreground font-medium">
                  {plannedProtein != null ? `${Math.round(plannedProtein)}g protein planned for today.` : "Generate your plate to hit macros."}
                </p>
                <div className="mt-6 flex items-center gap-2 text-[13px] font-bold text-white group-hover:text-accent transition-colors">
                  View full breakdown <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                </div>
              </div>
              
              {/* Minimal Circle Graphic */}
              <div className="relative w-32 h-32 md:w-40 md:h-40 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--surface-2)" strokeWidth="12" />
                  <motion.circle 
                    cx="50" cy="50" r="40" 
                    fill="none" 
                    stroke="var(--accent)" 
                    strokeWidth="12" 
                    strokeLinecap="round"
                    strokeDasharray="251.2"
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (251.2 * (calPct / 100)) }}
                    transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Goal</span>
                  <span className="text-lg font-black text-white">{targetKcal}</span>
                </div>
              </div>
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Workout Card */}
            <motion.div variants={itemVariants}>
              <Link href="/dashboard/workout" className="surface-card-hover group flex flex-col h-full min-h-[200px] justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                   <HugeiconsIcon icon={Dumbbell01Icon} size={80} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <HugeiconsIcon icon={Dumbbell01Icon} size={16} className="text-white" />
                    <span className="label-caps text-white">Training</span>
                  </div>
                  <p className="text-xl font-bold tracking-tight text-white mb-1">
                    Today&apos;s Block
                  </p>
                  <p className="text-sm text-muted-foreground font-medium max-w-[200px]">
                    Log your sets, track volume, and progressive overload.
                  </p>
                </div>
                <div className="mt-8 flex items-center gap-2 text-[13px] font-bold text-accent">
                  Start Workout <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                </div>
              </Link>
            </motion.div>

            {/* Metrics Mini-Grid */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
              <div className="surface-card p-5 flex flex-col justify-between">
                <span className="label-caps">Meals</span>
                <div>
                  <span className="text-3xl font-black text-white">{mealsLogged}</span>
                  <span className="text-sm text-muted-foreground font-bold ml-1">/ 4</span>
                </div>
              </div>
              <div className="surface-card p-5 flex flex-col justify-between">
                <span className="label-caps">Streak</span>
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={FireIcon} size={24} className="text-[#FF453A]" />
                  <span className="text-3xl font-black text-white">—</span>
                </div>
              </div>
              <div className="surface-card p-5 flex flex-col justify-between col-span-2">
                <span className="label-caps text-white flex items-center gap-1">
                  <HugeiconsIcon icon={Target01Icon} size={14} /> Protein Target
                </span>
                <div className="mt-2 h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${plannedProtein ? Math.min((plannedProtein/targetProtein)*100, 100) : 0}%` }}
                    transition={{ duration: 1, delay: 0.8 }}
                    className="h-full bg-white rounded-full" 
                  />
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div variants={itemVariants}>
              <Link href="/dashboard/chat" className="surface-card-hover group flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-white">
                    <HugeiconsIcon icon={AiChat01Icon} size={24} />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-white">Coach Chat</p>
                    <p className="text-[12px] font-medium text-muted-foreground">Ask nutrition & fitness questions</p>
                  </div>
                </div>
                <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="text-muted-foreground group-hover:text-white transition-colors" />
              </Link>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Link href="/dashboard/progress" className="surface-card-hover group flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-white">
                    <HugeiconsIcon icon={Analytics01Icon} size={24} />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-white">Data & Progress</p>
                    <p className="text-[12px] font-medium text-muted-foreground">Weight trends & Adaptive TDEE</p>
                  </div>
                </div>
                <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="text-muted-foreground group-hover:text-white transition-colors" />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </DashboardShell>
  );
}
