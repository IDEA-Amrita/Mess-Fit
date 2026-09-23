"use client";

import { useRouter } from "next/navigation";
import { DietFields } from "@/components/onboarding/fields";
import { StepActions, StepHeading } from "@/components/onboarding/controls";
import { useOnboardingForm } from "@/components/onboarding/use-onboarding-form";

export default function DietStep() {
  const router = useRouter();
  const form = useOnboardingForm();

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    router.push("/onboarding/hostel");
  }

  return (
    <form onSubmit={handleNext} className="flex flex-col gap-5">
      <StepHeading title="Diet & health" description="Helps us filter foods and adjust your macros." />
      <DietFields {...form} />
      <StepActions onBack={() => router.push("/onboarding/goal")} />
    </form>
  );
}
