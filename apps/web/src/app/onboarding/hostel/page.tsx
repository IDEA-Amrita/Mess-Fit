"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { CanteenFreq, Equipment, ProfilePayload, HostelContextPayload } from "@/lib/types";

const canteenOptions: { value: CanteenFreq; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "rare", label: "Rare (1–2×/week)" },
  { value: "frequent", label: "Frequent (3–5×/week)" },
  { value: "daily", label: "Daily" },
];

const equipmentOptions: { value: Equipment; label: string }[] = [
  { value: "bodyweight", label: "Bodyweight only" },
  { value: "bands", label: "Resistance bands" },
  { value: "college_gym", label: "College gym" },
  { value: "home_gym", label: "Home gym" },
];

export default function HostelStep() {
  const router = useRouter();
  const store = useOnboardingStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleEquipment(eq: Equipment) {
    const list = store.equipment.includes(eq)
      ? store.equipment.filter((e) => e !== eq)
      : [...store.equipment, eq];
    store.setField("equipment", list);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Save profile
      const profilePayload: ProfilePayload = {
        dob: store.dob,
        sex: store.sex,
        height_cm: store.height_cm,
        current_weight_kg: store.current_weight_kg,
        target_weight_kg: store.target_weight_kg,
        target_rate_kg_per_week: store.target_rate_kg_per_week,
        goal: store.goal,
        activity_level: store.activity_level,
        diet_type: store.diet_type,
        allergies: store.allergies,
        conditions: store.conditions,
      };
      await apiFetch("/api/v1/profile/me", {
        method: "PUT",
        body: JSON.stringify(profilePayload),
      });

      // Save hostel context
      const hostelPayload: HostelContextPayload = {
        mess_id: store.mess_id,
        canteen_freq: store.canteen_freq,
        canteen_typical_spend_inr: store.canteen_typical_spend_inr,
        top_up_budget_inr_weekly: store.top_up_budget_inr_weekly,
        equipment: store.equipment,
        workout_minutes_per_day: store.workout_minutes_per_day,
        workout_days_per_week: store.workout_days_per_week,
        gym_access_days: store.gym_access_days,
      };
      await apiFetch("/api/v1/profile/hostel-context", {
        method: "PUT",
        body: JSON.stringify(hostelPayload),
      });

      // Mark onboarding complete in Supabase user metadata.
      // This refreshes the JWT so the middleware sees onboarded=true
      // on the next request.
      const { error: updateErr } = await supabase.auth.updateUser({
        data: { onboarded: true },
      });
      if (updateErr) throw new Error(updateErr.message);

      // Force a session refresh so the new JWT is used immediately.
      await supabase.auth.refreshSession();

      // Navigate to targets page
      router.push("/onboarding/targets");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "#f0f0f0" }}>
          Hostel context
        </h2>
        <p className="mt-1 text-sm" style={{ color: "#666" }}>
          Your mess, canteen access, and workout setup.
        </p>
      </div>

      {/* Canteen frequency */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium" style={{ color: "#9a9a9a" }}>
          How often do you eat at the canteen?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {canteenOptions.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => store.setField("canteen_freq", c.value)}
              className="rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
              style={
                store.canteen_freq === c.value
                  ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)" }
                  : { background: "rgba(255,255,255,0.04)", color: "#888", border: "1px solid rgba(255,255,255,0.08)" }
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <Field label={`Weekly top-up budget — ₹${store.top_up_budget_inr_weekly}`}>
        <input
          type="range"
          min={0}
          max={1000}
          step={50}
          value={store.top_up_budget_inr_weekly}
          onChange={(e) => store.setField("top_up_budget_inr_weekly", Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-xs" style={{ color: "#444" }}>
          <span>₹0</span>
          <span>₹1000</span>
        </div>
      </Field>

      {/* Equipment */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium" style={{ color: "#9a9a9a" }}>
          Workout equipment available
        </label>
        <div className="flex flex-wrap gap-2">
          {equipmentOptions.map((eq) => (
            <button
              key={eq.value}
              type="button"
              onClick={() => toggleEquipment(eq.value)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={
                store.equipment.includes(eq.value)
                  ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)" }
                  : { background: "rgba(255,255,255,0.04)", color: "#666", border: "1px solid rgba(255,255,255,0.08)" }
              }
            >
              {eq.label}
            </button>
          ))}
        </div>
      </div>

      {/* Workout days */}
      <Field label={`Workout days/week — ${store.workout_days_per_week}`}>
        <input
          type="range"
          min={0}
          max={7}
          value={store.workout_days_per_week}
          onChange={(e) => store.setField("workout_days_per_week", Number(e.target.value))}
          className="w-full accent-amber-500"
        />
      </Field>

      {/* Workout minutes */}
      <Field label={`Minutes per session — ${store.workout_minutes_per_day}`}>
        <input
          type="range"
          min={0}
          max={120}
          step={5}
          value={store.workout_minutes_per_day}
          onChange={(e) => store.setField("workout_minutes_per_day", Number(e.target.value))}
          className="w-full accent-amber-500"
        />
      </Field>

      {error && (
        <p
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push("/onboarding/diet")}
          className="flex-1 rounded-xl py-3 text-sm font-medium"
          style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}
        >
          ← Back
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "#000" }}
        >
          {submitting ? "Saving…" : "See my targets →"}
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
