"use client";

import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding-store";
import {
  Field,
  OptionButton,
  RangeInput,
  StepActions,
  StepHeading,
} from "@/components/onboarding/controls";

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
      <StepHeading title="About you" description="Basic info to calculate your targets." />

      {/* DOB */}
      <Field label="Date of birth">
        <input
          type="date"
          value={dob}
          onChange={(e) => setField("dob", e.target.value)}
          required
          className="scheme-dark rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring"
        />
      </Field>

      {/* Sex */}
      <Field label="Biological sex">
        <div className="flex gap-2">
          {(["male", "female", "other"] as const).map((s) => (
            <OptionButton
              key={s}
              active={sex === s}
              onClick={() => setField("sex", s)}
              className="flex-1 capitalize"
            >
              {s}
            </OptionButton>
          ))}
        </div>
      </Field>

      {/* Height */}
      <Field label={`Height — ${height_cm} cm`}>
        <RangeInput
          min={120}
          max={220}
          value={height_cm}
          onChange={(e) => setField("height_cm", Number(e.target.value))}
        />
        <div className="flex justify-between text-xs text-muted-foreground/60">
          <span>120 cm</span>
          <span>220 cm</span>
        </div>
      </Field>

      {/* Weight */}
      <Field label={`Current weight — ${current_weight_kg} kg`}>
        <RangeInput
          min={30}
          max={150}
          step={0.5}
          value={current_weight_kg}
          onChange={(e) => setField("current_weight_kg", Number(e.target.value))}
        />
        <div className="flex justify-between text-xs text-muted-foreground/60">
          <span>30 kg</span>
          <span>150 kg</span>
        </div>
      </Field>

      <StepActions disabled={!dob} />
    </form>
  );
}
