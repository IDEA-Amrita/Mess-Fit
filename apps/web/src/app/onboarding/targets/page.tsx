"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
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

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2"
          style={{ borderColor: "rgba(255,255,255,0.12)", borderTopColor: "#f59e0b" }}
        />
        <p className="text-sm" style={{ color: "#555" }}>Computing your targets…</p>
      </div>
    );
  }

  if (error || !targets) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-sm" style={{ color: "#f87171" }}>{error ?? "Failed to load targets"}</p>
        <button
          onClick={() => router.push("/onboarding/hostel")}
          className="text-sm font-medium"
          style={{ color: "#f59e0b" }}
        >
          ← Go back
        </button>
      </div>
    );
  }

  const bmiColors: Record<string, string> = {
    underweight: "#60a5fa",
    normal: "#34d399",
    overweight: "#fbbf24",
    obese: "#f87171",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-bold" style={{ color: "#f0f0f0" }}>
          Your daily targets
        </h2>
        <p className="mt-1 text-sm" style={{ color: "#666" }}>
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
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button
          onClick={() => setShowMath(!showMath)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-semibold" style={{ color: "#d0d0d0" }}>
            Why these numbers?
          </span>
          <span className="text-xs" style={{ color: "#555" }}>
            {showMath ? "▲ Hide" : "▼ Show math"}
          </span>
        </button>

        {showMath && (
          <div
            className="border-t px-5 py-4 space-y-3"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
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

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => router.push("/onboarding/profile")}
          className="flex-1 rounded-xl py-3 text-sm font-medium"
          style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}
        >
          ← Adjust
        </button>
        <Link
          href="/dashboard"
          className="flex flex-1 items-center justify-center rounded-xl py-3 text-sm font-semibold transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "#000" }}
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
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#555" }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold" style={{ color: accent }}>
        {value}
        <span className="ml-1 text-sm font-normal" style={{ color: "#666" }}>
          {unit}
        </span>
      </p>
    </div>
  );
}

function MathRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium" style={{ color: "#888" }}>
        {label}
      </span>
      <span className="text-xs font-mono" style={{ color: "#d0d0d0" }}>
        {value}
      </span>
    </div>
  );
}
