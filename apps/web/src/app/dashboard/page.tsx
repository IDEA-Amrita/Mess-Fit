"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlateIcon, Target01Icon, CheckListIcon } from "@hugeicons/core-free-icons";
import { supabase } from "@/lib/supabase";
import { DashboardShell } from "@/components/DashboardShell";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function DashboardPage() {
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setDisplayName((data.user.user_metadata?.display_name as string) ?? null);
      }
    });
  }, []);

  const firstName = displayName?.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <DashboardShell>
      <div className="mf-rise mx-auto w-full max-w-5xl flex-1 space-y-6 p-5 sm:p-6">
        <PageHeader title={`Good ${timeOfDay()}, ${firstName} 👋`} description={today} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Calories today"
            value="—"
            accent
            icon={<HugeiconsIcon icon={Target01Icon} size={18} strokeWidth={1.5} color="currentColor" />}
            hint="From today's plate"
          />
          <StatCard
            label="Protein"
            value="—"
            unit="g"
            icon={<HugeiconsIcon icon={PlateIcon} size={18} strokeWidth={1.5} color="currentColor" />}
            hint="From today's plate"
          />
          <StatCard
            label="Meals logged"
            value="—"
            icon={<HugeiconsIcon icon={CheckListIcon} size={18} strokeWidth={1.5} color="currentColor" />}
            hint="This week"
          />
        </div>

        <EmptyState
          icon={<HugeiconsIcon icon={PlateIcon} size={26} strokeWidth={1.5} color="currentColor" />}
          title="Your plate is ready to build"
          description="See your personalised meal plan from today's mess menu — portions tuned to your targets."
          action={
            <Link href="/dashboard/plate" className={buttonVariants({ variant: "default", size: "lg" })}>
              Open today&apos;s plate
            </Link>
          }
        />
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
