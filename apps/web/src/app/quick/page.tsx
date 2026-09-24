"use client";
import { HugeiconsIcon } from "@hugeicons/react";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft02Icon, InformationCircleIcon, Restaurant01Icon } from "@hugeicons/core-free-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { optimizeToday, type OptimizationResult } from "@/lib/optimizer-api";
import { cn } from "@/lib/utils";

// ── helper: infer current meal ───────────────────────────────────────────────

type MealType = "breakfast" | "lunch" | "snack" | "dinner";

function getCurrentMealSlot(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snacks",
  dinner: "Dinner",
};

export default function QuickModePage() {
  const [slot, setSlot] = useState<MealType | null>(null);

  useEffect(() => {
    setSlot(getCurrentMealSlot());
  }, []);

  const plate = useQuery<OptimizationResult>({
    queryKey: ["plate", "today"],
    queryFn: optimizeToday,
    retry: 0,
    staleTime: 0,
  });

  if (!slot) return null; // Hydration gap

  const CARD = "rounded-xl border border-border bg-card p-6";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      {/* Minimal Header */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/5 bg-background/80 px-4 backdrop-blur-lg">
        <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
          <HugeiconsIcon icon={ArrowLeft02Icon} className="h-5 w-5" />
          <span className="text-sm font-medium">Dashboard</span>
        </Link>
        <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
          QUICK MODE
        </span>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{MEAL_LABELS[slot]}</h1>
            <p className="text-muted-foreground">What to put on your plate right now.</p>
          </div>

          {plate.isLoading ? (
            <div className={CARD}>
              <div className="space-y-4">
                <Skeleton className="h-6 w-1/3 bg-white/5" />
                <Skeleton className="h-4 w-full bg-white/5" />
                <Skeleton className="h-4 w-5/6 bg-white/5" />
                <Skeleton className="h-4 w-4/6 bg-white/5" />
              </div>
            </div>
          ) : plate.isError ? (
            <ErrorState title="Couldn't build your plate" error={plate.error} onRetry={() => plate.refetch()} />
          ) : !plate.data?.plan[slot] || plate.data.plan[slot].length === 0 ? (
            <div className={CARD}>
              <EmptyState
                icon={<HugeiconsIcon icon={InformationCircleIcon} className="h-6 w-6" />}
                title="No plan available"
                description={`Nothing on today's menu fits your targets for ${slot}. You can still log what you eat.`}
                action={
                  <Link href="/dashboard/log" className={buttonVariants({ variant: "outline", className: "mt-2" })}>
                    Log manually
                  </Link>
                }
              />
            </div>
          ) : (
            <div className={cn("space-y-4", CARD)}>
              <div className="flex items-center gap-2 border-b border-border pb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <HugeiconsIcon icon={Restaurant01Icon} className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Your Plate</h2>
                  <p className="text-xs text-muted-foreground">Stay within these limits</p>
                </div>
              </div>

              <ul className="space-y-3 pt-2">
                {plate.data.plan[slot].map((item, idx) => (
                  <li key={idx} className="flex items-baseline justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{item.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {item.protein_g}g P · {item.carbs_g}g C · {item.fats_g}g F
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block text-lg font-bold tabular-nums text-accent">
                        {item.portions} <span className="text-sm font-medium text-muted-foreground">{item.serving_unit}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-center pt-8">
            <Link href="/dashboard/log" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto min-w-[200px]" })}>
              Log this meal
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
