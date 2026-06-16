"use client";

import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding-store";
import type { DietType } from "@/lib/types";
import {
  OptionButton,
  StepActions,
  StepHeading,
} from "@/components/onboarding/controls";

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

const CHIP = "rounded-lg px-3 py-1.5 text-xs";

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
      <StepHeading
        title="Diet & health"
        description="Helps us filter foods and adjust your macros."
      />

      {/* Diet type */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">Diet type</label>
        <div className="grid grid-cols-2 gap-2">
          {dietOptions.map((d) => (
            <OptionButton
              key={d.value}
              active={diet_type === d.value}
              onClick={() => setField("diet_type", d.value)}
            >
              {d.label}
            </OptionButton>
          ))}
        </div>
      </div>

      {/* Allergies */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Allergies (select any that apply)
        </label>
        <div className="flex flex-wrap gap-2">
          {allergyOptions.map((a) => (
            <OptionButton
              key={a}
              tone="danger"
              active={allergies.includes(a)}
              onClick={() => setField("allergies", toggleItem(allergies, a))}
              className={`${CHIP} capitalize`}
            >
              {a}
            </OptionButton>
          ))}
        </div>
      </div>

      {/* Conditions */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Medical conditions (select any that apply)
        </label>
        <div className="flex flex-wrap gap-2">
          {conditionOptions.map((c) => (
            <OptionButton
              key={c.value}
              active={conditions.includes(c.value)}
              onClick={() => setField("conditions", toggleItem(conditions, c.value))}
              className={CHIP}
            >
              {c.label}
            </OptionButton>
          ))}
        </div>
      </div>

      <StepActions onBack={() => router.push("/onboarding/goal")} />
    </form>
  );
}
