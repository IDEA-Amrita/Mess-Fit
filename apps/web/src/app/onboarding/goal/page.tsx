"use client";

import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding-store";
import type { Goal } from "@/lib/types";
import {
  Field,
  RangeInput,
  StepActions,
  StepHeading,
} from "@/components/onboarding/controls";

const goals: { value: Goal; label: string; desc: string }[] = [
  { value: "gain", label: "Gain weight", desc: "Build muscle, increase mass" },
  { value: "lose", label: "Lose weight", desc: "Cut fat, get leaner" },
  { value: "maintain", label: "Maintain", desc: "Stay where you are" },
];

const activityLabels: Record<number, string> = {
  1: "Sedentary (desk + no exercise)",
  2: "Light (1–3 sessions/week)",
  3: "Moderate (3–5 sessions/week)",
  4: "Active (6–7 sessions/week)",
  5: "Very active (athlete / physical job)",
};

export default function GoalStep() {
  const router = useRouter();
  const {
    goal,
    target_weight_kg,
    target_rate_kg_per_week,
    activity_level,
    current_weight_kg,
    setField,
  } = useOnboardingStore();

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    router.push("/onboarding/diet");
  }

  return (
    <form onSubmit={handleNext} className="flex flex-col gap-5">
      <StepHeading title="Your goal" description="What do you want to achieve?" />

      {/* Goal selection */}
      <div className="flex flex-col gap-2">
        {goals.map((g) => {
          const active = goal === g.value;
          return (
            <button
              key={g.value}
              type="button"
              onClick={() => {
                setField("goal", g.value);
                if (g.value === "maintain") {
                  setField("target_weight_kg", current_weight_kg);
                  setField("target_rate_kg_per_week", 0);
                }
              }}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                active
                  ? "border-accent/40 bg-accent-muted"
                  : "border-border bg-surface-2 hover:border-border-strong"
              }`}
            >
              <span
                className={`text-sm font-semibold ${active ? "text-accent" : "text-foreground"}`}
              >
                {g.label}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">{g.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Target weight (only for gain/lose) */}
      {goal !== "maintain" && (
        <Field label={`Target weight — ${target_weight_kg} kg`}>
          <RangeInput
            min={30}
            max={150}
            step={0.5}
            value={target_weight_kg}
            onChange={(e) => setField("target_weight_kg", Number(e.target.value))}
          />
        </Field>
      )}

      {/* Rate */}
      {goal !== "maintain" && (
        <Field
          label={`Rate — ${Math.abs(target_rate_kg_per_week)} kg/week ${goal === "gain" ? "gain" : "loss"}`}
        >
          <RangeInput
            min={0.1}
            max={0.5}
            step={0.05}
            value={Math.abs(target_rate_kg_per_week) || 0.25}
            onChange={(e) => {
              const v = Number(e.target.value);
              setField("target_rate_kg_per_week", goal === "lose" ? -v : v);
            }}
          />
          <div className="flex justify-between text-xs text-muted-foreground/60">
            <span>0.1 (gentle)</span>
            <span>0.5 (aggressive)</span>
          </div>
        </Field>
      )}

      {/* Activity level */}
      <Field label={`Activity level — ${activityLabels[activity_level]}`}>
        <RangeInput
          min={1}
          max={5}
          value={activity_level}
          onChange={(e) => setField("activity_level", Number(e.target.value))}
        />
        <div className="flex justify-between text-xs text-muted-foreground/60">
          <span>Sedentary</span>
          <span>Very active</span>
        </div>
      </Field>

      <StepActions onBack={() => router.push("/onboarding/profile")} />
    </form>
  );
}
