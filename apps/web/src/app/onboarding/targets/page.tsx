"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, PlateIcon, SparklesIcon, Tick01Icon } from "@hugeicons/core-free-icons";
import { ErrorState } from "@/components/ui/error-state";
import { apiFetch } from "@/lib/api";
import { clearOnboardingData } from "@/lib/onboarding-store";
import { BMI_COLORS } from "@/lib/profile-form";
import { optimizeToday } from "@/lib/optimizer-api";
import { spring } from "@/lib/motion";
import type { Targets } from "@/lib/types";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { Skeleton } from "@/components/ui/skeleton";

// Data-viz colours (they mirror the Plate and Progress screens), not chrome tokens.
const MACRO = {
  protein: { label: "Protein", color: "#60a5fa", kcalPerG: 4 },
  carbs: { label: "Carbs", color: "#34d399", kcalPerG: 4 },
  fats: { label: "Fats", color: "#f472b6", kcalPerG: 9 },
} as const;

export default function TargetsPage() {
  const router = useRouter();
  const [showMath, setShowMath] = useState(false);
  const reduce = useReducedMotion();

  // Always refetch: the user may have just changed their profile.
  const targetsQuery = useQuery({
    queryKey: ["targets"],
    queryFn: () => apiFetch<Targets>("/api/v1/profile/targets"),
    staleTime: 0,
    retry: 0,
  });
  const targets = targetsQuery.data;

  const previewQuery = useQuery({
    queryKey: ["plate", "preview"],
    queryFn: optimizeToday,
    enabled: !!targets, // only after the targets exist
    retry: 0,
    staleTime: 0,
  });

  if (targetsQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Computing your targets">
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="h-44 rounded-3xl" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <p className="text-center text-sm text-muted-foreground/60">Computing your targets…</p>
      </div>
    );
  }

  if (targetsQuery.isError || !targets) {
    return (
      <ErrorState
        title="Couldn't calculate your targets"
        error={targetsQuery.error}
        onRetry={() => targetsQuery.refetch()}
        action={
          <div className="flex gap-4 text-sm font-medium">
            <button onClick={() => targetsQuery.refetch()} className="text-accent">
              Try again
            </button>
            <button onClick={() => router.push("/onboarding/hostel")} className="text-muted-foreground hover:text-foreground">
              &larr; Go back
            </button>
          </div>
        }
      />
    );
  }

  const bmiColor = BMI_COLORS[targets.bmi_class];
  const macros = [
    { ...MACRO.protein, grams: targets.daily_protein_g },
    { ...MACRO.carbs, grams: targets.daily_carbs_g },
    { ...MACRO.fats, grams: targets.daily_fats_g },
  ].map((m) => ({ ...m, kcal: m.grams * m.kcalPerG }));
  const macroKcal = macros.reduce((sum, m) => sum + m.kcal, 0) || 1;
  const withShare = macros.map((m) => ({ ...m, pct: Math.round((m.kcal / macroKcal) * 100) }));

  const conditions = (targets.rationale.conditions_applied as string[] | undefined) ?? [];
  const previewPlan = previewQuery.data?.plan ?? {};
  const hasPreview = Object.values(previewPlan).some((items) => items.length > 0);

  return (
    <Stagger onMount className="flex flex-col gap-6">
      <StaggerItem className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...spring.snappy, delay: 0.15 }}
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_0_30px_rgba(204,255,0,0.35)]"
        >
          <HugeiconsIcon icon={Tick01Icon} className="h-6 w-6" />
        </motion.div>
        <h2 className="text-h2 text-foreground">Your daily targets</h2>
        <p className="mt-1 text-sm text-muted-foreground">Personalized for your body, goal, and conditions.</p>
      </StaggerItem>

      {/* Calories + macro split */}
      <StaggerItem>
        <div className="rounded-3xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-caps">Daily calories</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <AnimatedNumber value={targets.daily_kcal} className="text-5xl font-black tabular-nums text-accent" />
                <span className="text-sm font-medium text-muted-foreground">kcal</span>
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize"
              style={{ background: `${bmiColor}20`, color: bmiColor, border: `1px solid ${bmiColor}40` }}
            >
              BMI {targets.bmi} · {targets.bmi_class}
            </span>
          </div>

          <div
            className="mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`Calories from ${withShare.map((m) => `${m.label.toLowerCase()} ${m.pct}%`).join(", ")}`}
          >
            {withShare.map((m, i) => (
              <motion.div
                key={m.label}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ background: m.color }}
                initial={{ width: 0 }}
                animate={{ width: `${m.pct}%` }}
                transition={reduce ? { duration: 0 } : { duration: 0.9, delay: 0.3 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
          </div>
        </div>
      </StaggerItem>

      <StaggerItem className="grid grid-cols-3 gap-3">
        {withShare.map((m) => (
          <div key={m.label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: m.color }} />
              {m.label}
            </p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums" style={{ color: m.color }}>
              <AnimatedNumber value={m.grams} />
              <span className="ml-0.5 text-sm font-normal text-muted-foreground">g</span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">{m.pct}% of calories</p>
          </div>
        ))}
      </StaggerItem>

      {/* Why these numbers? */}
      <StaggerItem>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <button
            onClick={() => setShowMath((v) => !v)}
            aria-expanded={showMath}
            aria-controls="targets-math"
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-sm font-semibold text-foreground">Why these numbers?</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
              {showMath ? "Hide" : "Show the math"}
              <motion.span animate={{ rotate: showMath ? 180 : 0 }} transition={spring.snappy} className="flex">
                <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4" />
              </motion.span>
            </span>
          </button>

          <AnimatePresence initial={false}>
            {showMath && (
              <motion.div
                id="targets-math"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-3 border-t border-border px-5 py-4">
                  <MathRow label="Age" value={String(targets.rationale.age)} />
                  <MathRow label="BMI" value={String(targets.rationale.bmi_formula)} />
                  <MathRow label="Classification" value={String(targets.rationale.bmi_classification_basis)} />
                  <MathRow label="BMR" value={String(targets.rationale.bmr_formula)} />
                  <MathRow label="TDEE" value={String(targets.rationale.tdee_formula)} />
                  <MathRow label="Daily target" value={String(targets.rationale.kcal_target_basis)} />
                  <MathRow label="Protein" value={String(targets.rationale.protein_basis)} />
                  <MathRow label="Fats" value={String(targets.rationale.fats_basis)} />
                  <MathRow label="Carbs" value={String(targets.rationale.carbs_basis)} />
                  {conditions.length > 0 && <MathRow label="Conditions applied" value={conditions.join(", ")} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </StaggerItem>

      {/* What this means for you */}
      <StaggerItem>
        <div className="overflow-hidden rounded-2xl border border-accent/20 bg-accent-muted">
          <div className="flex items-start gap-3 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
              <HugeiconsIcon icon={PlateIcon} className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">What this means for you</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                To hit <span className="font-medium text-foreground">{targets.daily_protein_g}g</span>{" "}
                of protein on a
                standard Indian mess diet, you&apos;d normally need to eat an impossible amount of dal.
                <br />
                <br />
                We&apos;ll help you pick the highest protein items from your specific mess menu each meal, and suggest
                cheap gap-fills (like eggs or whey) for the rest.
              </p>
            </div>
          </div>
        </div>
      </StaggerItem>

      {/* Preview plate */}
      {previewQuery.isFetching && !previewQuery.data && (
        <StaggerItem>
          <div className="rounded-2xl border border-border bg-surface p-5" aria-busy="true" aria-label="Building your preview plate">
            <div className="mb-4 flex items-center gap-2">
              <HugeiconsIcon icon={SparklesIcon} className="h-5 w-5 animate-pulse text-accent" />
              <h3 className="font-semibold text-foreground">Building your preview plate…</h3>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5 w-4/5" />
            </div>
          </div>
        </StaggerItem>
      )}
      {hasPreview && (
        <StaggerItem>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <HugeiconsIcon icon={SparklesIcon} className="h-5 w-5 text-accent" />
              <h3 className="font-semibold text-foreground">Here is your preview plate for today:</h3>
            </div>
            <div className="space-y-4">
              {Object.entries(previewPlan).map(([meal, items]) => {
                if (!items.length) return null;
                return (
                  <div key={meal}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{meal}</p>
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li key={item.dish_id} className="flex justify-between gap-3 text-sm">
                          <span className="text-foreground">{item.name}</span>
                          <span className="shrink-0 font-medium text-accent">
                            {item.portions} {item.serving_unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </StaggerItem>
      )}

      {/* Actions */}
      <StaggerItem className="flex gap-3">
        {/* Onboarding is finished, so the earlier steps are closed off (the middleware
            bounces to /dashboard); Settings is where the profile is edited now. */}
        <Link
          href="/dashboard/settings#plan"
          onClick={clearOnboardingData}
          className="flex flex-1 items-center justify-center rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Adjust in Settings
        </Link>
        <Link
          href="/dashboard"
          onClick={clearOnboardingData}
          className="flex flex-1 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--accent-dark),var(--accent))] py-3 text-sm font-semibold text-primary-foreground transition-[filter] hover:brightness-110"
        >
          Looks good →
        </Link>
      </StaggerItem>
    </Stagger>
  );
}

function MathRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="font-mono text-xs text-foreground/80">{value}</span>
    </div>
  );
}
