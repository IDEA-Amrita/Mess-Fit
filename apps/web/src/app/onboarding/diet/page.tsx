"use client";

import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding-store";
import type { DietType } from "@/lib/types";

const dietOptions: { value: DietType; label: string }[] = [
  { value: "veg", label: "Vegetarian" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "non_veg", label: "Non-vegetarian" },
  { value: "jain", label: "Jain" },
];

const allergyOptions = [
  "lactose", "gluten", "nuts", "soy", "eggs", "seafood", "mustard", "sesame",
];

const conditionOptions = [
  { value: "diabetes", label: "Diabetes" },
  { value: "hypertension", label: "Hypertension" },
  { value: "pcos", label: "PCOS" },
  { value: "ibs", label: "IBS" },
  { value: "gerd", label: "GERD" },
  { value: "anemia", label: "Anemia" },
  { value: "hypothyroid", label: "Hypothyroid" },
];

export default function DietStep() {
  const router = useRouter();
  const { diet_type, allergies, conditions, setField } = useOnboardingStore();

  function toggleItem(list: string[], item: string): string[] {
    return list.includes(item)
      ? list.filter((x) => x !== item)
      : [...list, item];
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    router.push("/onboarding/hostel");
  }

  return (
    <form onSubmit={handleNext} className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "#f0f0f0" }}>
          Diet & health
        </h2>
        <p className="mt-1 text-sm" style={{ color: "#666" }}>
          Helps us filter foods and adjust your macros.
        </p>
      </div>

      {/* Diet type */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium" style={{ color: "#9a9a9a" }}>
          Diet type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {dietOptions.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setField("diet_type", d.value)}
              className="rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
              style={
                diet_type === d.value
                  ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)" }
                  : { background: "rgba(255,255,255,0.04)", color: "#888", border: "1px solid rgba(255,255,255,0.08)" }
              }
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Allergies */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium" style={{ color: "#9a9a9a" }}>
          Allergies (select any that apply)
        </label>
        <div className="flex flex-wrap gap-2">
          {allergyOptions.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setField("allergies", toggleItem(allergies, a))}
              className="rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all"
              style={
                allergies.includes(a)
                  ? { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }
                  : { background: "rgba(255,255,255,0.04)", color: "#666", border: "1px solid rgba(255,255,255,0.08)" }
              }
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Conditions */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium" style={{ color: "#9a9a9a" }}>
          Medical conditions (select any that apply)
        </label>
        <div className="flex flex-wrap gap-2">
          {conditionOptions.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setField("conditions", toggleItem(conditions, c.value))}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={
                conditions.includes(c.value)
                  ? { background: "rgba(168,85,247,0.15)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.3)" }
                  : { background: "rgba(255,255,255,0.04)", color: "#666", border: "1px solid rgba(255,255,255,0.08)" }
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push("/onboarding/goal")}
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
