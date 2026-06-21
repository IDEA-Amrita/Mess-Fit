"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlateIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import { apiFetch } from "@/lib/api";
import { optimizeToday } from "@/lib/optimizer-api";
import type { Targets } from "@/lib/types";

export default function TargetsPage() {
  const router = useRouter();
  const [targets, setTargets] = useState<Targets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMath, setShowMath] = useState(false);

  useEffect(() => {
    apiFetch<Targets>("/api/v1/profile/targets")
      .then(setTargets)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const { data: previewPlate } = useQuery({
    queryKey: ["plate", "preview"],
    queryFn: optimizeToday,
    enabled: !!targets, // Fetch preview only after targets load
    retry: 0,
    staleTime: 0,
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        <p className="text-sm text-muted-foreground/60">Computing your targets…</p>
      </div>
    );
  }

  if (error || !targets) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-sm text-destructive">{error ?? "Failed to load targets"}</p>
        <button
          onClick={() => router.push("/onboarding/hostel")}
          className="text-sm font-medium text-accent"
        >
          ← Go back
        </button>
      </div>
    );
  }

  // Data-viz colors (mirror the progress charts) — kept as hex, not chrome tokens.
  const bmiColors: Record<string, string> = {
    underweight: "#60a5fa",
    normal: "#34d399",
    overweight: "#fbbf24",
    obese: "#f87171",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-h2 text-foreground">Your daily targets</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalized for your body, goal, and conditions.
        </p>
      </div>

      {/* BMI badge */}
      <div className="flex justify-center">
        <span
          className="rounded-full px-4 py-1.5 text-xs font-semibold capitalize"
          style={{
            background: `${bmiColors[targets.bmi_class]}20`,
            color: bmiColors[targets.bmi_class],
            border: `1px solid ${bmiColors[targets.bmi_class]}40`,
          }}
        >
          BMI {targets.bmi} — {targets.bmi_class}
        </span>
      </div>

      {/* Main targets */}
      <div className="grid grid-cols-2 gap-3">
        <TargetCard label="Calories" value={`${targets.daily_kcal}`} unit="kcal" accent="#f59e0b" />
        <TargetCard label="Protein" value={`${targets.daily_protein_g}`} unit="g" accent="#60a5fa" />
        <TargetCard label="Carbs" value={`${targets.daily_carbs_g}`} unit="g" accent="#34d399" />
        <TargetCard label="Fats" value={`${targets.daily_fats_g}`} unit="g" accent="#f472b6" />
      </div>

      {/* Why these numbers? */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-1">
        <button
          onClick={() => setShowMath(!showMath)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-semibold text-foreground">Why these numbers?</span>
          <span className="text-xs text-muted-foreground/60">
            {showMath ? "▲ Hide" : "▼ Show math"}
          </span>
        </button>

        {showMath && (
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
            {(targets.rationale.conditions_applied as string[]).length > 0 && (
              <MathRow
                label="Conditions applied"
                value={(targets.rationale.conditions_applied as string[]).join(", ")}
              />
            )}
          </div>
        )}
      </div>

      {/* U7: What this means for you */}
      <div className="overflow-hidden rounded-2xl border border-accent/20 bg-accent-muted">
        <div className="flex items-start gap-3 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
            <HugeiconsIcon icon={PlateIcon} className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">What this means for you</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              To hit <span className="font-medium text-foreground">{targets.daily_protein_g}g</span> of protein on a standard Indian mess diet, you'd normally need to eat an impossible amount of dal. 
              <br /><br />
              We'll help you pick the highest protein items from your specific mess menu each meal, and suggest cheap gap-fills (like eggs or whey) for the rest.
            </p>
          </div>
        </div>
      </div>

      {/* U9: Preview Plate */}
      {previewPlate && Object.keys(previewPlate.plan).length > 0 && (
        <div className="rounded-2xl border border-border bg-surface-1 p-5">
          <div className="flex items-center gap-2 mb-4">
            <HugeiconsIcon icon={SparklesIcon} className="h-5 w-5 text-accent" />
            <h3 className="font-semibold text-foreground">Here is your preview plate for today:</h3>
          </div>
          <div className="space-y-4">
            {Object.entries(previewPlate.plan).map(([meal, items]) => {
              if (!items.length) return null;
              return (
                <div key={meal}>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    {meal}
                  </p>
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li key={item.dish_id} className="flex justify-between text-sm">
                        <span className="text-foreground">{item.name}</span>
                        <span className="text-accent font-medium">{item.portions} {item.serving_unit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => router.push("/onboarding/profile")}
          className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Adjust
        </button>
        <Link
          href="/dashboard"
          className="flex flex-1 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--accent-dark),var(--accent))] py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
        >
          Looks good →
        </Link>
      </div>
    </div>
  );
}

function TargetCard({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold" style={{ color: accent }}>
        {value}
        <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
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
