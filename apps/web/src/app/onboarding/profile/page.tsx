"use client";

import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding-store";

export default function ProfileStep() {
  const router = useRouter();
  const { dob, sex, height_cm, current_weight_kg, setField } =
    useOnboardingStore();

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    router.push("/onboarding/goal");
  }

  return (
    <form onSubmit={handleNext} className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "#f0f0f0" }}>
          About you
        </h2>
        <p className="mt-1 text-sm" style={{ color: "#666" }}>
          Basic info to calculate your targets.
        </p>
      </div>

      {/* DOB */}
      <Field label="Date of birth">
        <input
          type="date"
          value={dob}
          onChange={(e) => setField("dob", e.target.value)}
          required
          className="input-field"
        />
      </Field>

      {/* Sex */}
      <Field label="Biological sex">
        <div className="flex gap-2">
          {(["male", "female", "other"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setField("sex", s)}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium capitalize transition-all"
              style={
                sex === s
                  ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)" }
                  : { background: "rgba(255,255,255,0.05)", color: "#888", border: "1px solid rgba(255,255,255,0.1)" }
              }
            >
              {s}
            </button>
          ))}
        </div>
      </Field>

      {/* Height */}
      <Field label={`Height — ${height_cm} cm`}>
        <input
          type="range"
          min={120}
          max={220}
          value={height_cm}
          onChange={(e) => setField("height_cm", Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-xs" style={{ color: "#444" }}>
          <span>120 cm</span>
          <span>220 cm</span>
        </div>
      </Field>

      {/* Weight */}
      <Field label={`Current weight — ${current_weight_kg} kg`}>
        <input
          type="range"
          min={30}
          max={150}
          step={0.5}
          value={current_weight_kg}
          onChange={(e) => setField("current_weight_kg", Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-xs" style={{ color: "#444" }}>
          <span>30 kg</span>
          <span>150 kg</span>
        </div>
      </Field>

      <button
        type="submit"
        disabled={!dob}
        className="mt-2 rounded-xl py-3 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "#000" }}
      >
        Next →
      </button>
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
