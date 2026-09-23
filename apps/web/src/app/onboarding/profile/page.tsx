"use client";

import { useRouter } from "next/navigation";
import { validateBody } from "@/lib/profile-form";
import { BodyFields } from "@/components/onboarding/fields";
import { StepActions, StepHeading } from "@/components/onboarding/controls";
import { useOnboardingForm } from "@/components/onboarding/use-onboarding-form";

export default function ProfileStep() {
  const router = useRouter();
  const form = useOnboardingForm();
  const invalid = validateBody(form.values) !== null;

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (invalid) return;
    router.push("/onboarding/goal");
  }

  return (
    <form onSubmit={handleNext} className="flex flex-col gap-5">
      <StepHeading title="About you" description="Basic info to calculate your targets." />
      <BodyFields {...form} />
      <StepActions disabled={invalid} />
    </form>
  );
}
