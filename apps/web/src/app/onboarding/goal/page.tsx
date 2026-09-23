"use client";

import { useRouter } from "next/navigation";
import { goalPatch, validateGoal } from "@/lib/profile-form";
import { GoalFields } from "@/components/onboarding/fields";
import { StepActions, StepHeading } from "@/components/onboarding/controls";
import { useOnboardingForm } from "@/components/onboarding/use-onboarding-form";

export default function GoalStep() {
  const router = useRouter();
  const form = useOnboardingForm();
  const invalid = validateGoal(form.values) !== null;

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (invalid) return;
    // The user may have changed their weight on the previous step after picking
    // "maintain"; re-derive target/rate so we never save a stale target.
    form.patch(goalPatch(form.values, form.values.goal));
    router.push("/onboarding/diet");
  }

  return (
    <form onSubmit={handleNext} className="flex flex-col gap-5">
      <StepHeading title="Your goal" description="What do you want to achieve?" />
      <GoalFields {...form} />
      <StepActions onBack={() => router.push("/onboarding/profile")} disabled={invalid} />
    </form>
  );
}
