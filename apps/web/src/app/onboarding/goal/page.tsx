"use client";

import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding-store";
import type { Goal } from "@/lib/types";

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
      <div>
        <h2 className="text-xl font-bold" style={{ color: "#f0f0f0" }}>
          Your goal
        </h2>
        <p className="mt-1 text-sm" style={{ color: "#666" }}>
          What do you want to achieve?
        </p>
      </div>

      {/* Goal selection */}
      <div className="flex flex-col gap-2">
        {goals.map((g) => (
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
            className="rounded-xl px-4 py-3 text-left transition-all"
            style={
              goal === g.value
                ? { background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.4)" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }
            }
          >
            <span className="text-sm font-semibold" style={{ color: goal === g.value ? "#f59e0b" : "#d0d0d0" }}>
              {g.label}
            </span>
            <span className="ml-2 text-xs" style={{ color: "#555" }}>
              {g.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Target weight (only for gain/lose) */}
      {goal !== "maintain" && (
        <Field label={`Target weight — ${target_weight_kg} kg`}>
          <input
            type="range"
            min={30}
            max={150}
            step={0.5}
            value={target_weight_kg}
            onChange={(e) => setField("target_weight_kg", Number(e.target.value))}
            className="w-full accent-amber-500"
          />
        </Field>
      )}

      {/* Rate */}
      {goal !== "maintain" && (
        <Field
          label={`Rate — ${Math.abs(target_rate_kg_per_week)} kg/week ${goal === "gain" ? "gain" : "loss"}`}
        >
          <input
            type="range"
            min={0.1}
            max={0.5}
            step={0.05}
            value={Math.abs(target_rate_kg_per_week) || 0.25}
            onChange={(e) => {
              const v = Number(e.target.value);
              setField("target_rate_kg_per_week", goal === "lose" ? -v : v);
            }}
            className="w-full accent-amber-500"
          />
          <div className="flex justify-between text-xs" style={{ color: "#444" }}>
            <span>0.1 (gentle)</span>
            <span>0.5 (aggressive)</span>
          </div>
        </Field>
      )}

      {/* Activity level */}
      <Field label={`Activity level — ${activityLabels[activity_level]}`}>
        <input
          type="range"
          min={1}
          max={5}
          value={activity_level}
          onChange={(e) => setField("activity_level", Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-xs" style={{ color: "#444" }}>
          <span>Sedentary</span>
          <span>Very active</span>
        </div>
      </Field>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push("/onboarding/profile")}
          className="flex-1 rounded-xl py-3 text-sm font-medium"
          style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}
        >
          ← Back
        </button>
        <button
          type="submit"
          className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "#000" }}
        >
          Next →
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium" style={{ color: "#9a9a9a" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
