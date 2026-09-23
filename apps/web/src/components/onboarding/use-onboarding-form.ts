"use client";

import { useOnboardingStore } from "@/lib/onboarding-store";
import type { ProfileForm } from "@/lib/profile-form";
import type { FormApi } from "./fields";

/** Adapts the zustand onboarding store to the shared form-section props. */
export function useOnboardingForm(): FormApi {
  const state = useOnboardingStore();
  return {
    values: state,
    set: (key, value) => state.patch({ [key]: value } as Partial<ProfileForm>),
    patch: state.patch,
  };
}
