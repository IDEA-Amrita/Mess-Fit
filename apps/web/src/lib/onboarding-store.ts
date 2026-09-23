/**
 * Zustand store for onboarding form state.
 *
 * Holds all 4 steps' data in one place so the user can navigate
 * back and forth without losing input. Persists nothing to disk —
 * it's ephemeral and only lives during the onboarding session.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  CanteenFreq,
  DayOfWeek,
  DietType,
  Equipment,
  Goal,
  Sex,
} from "./types";

interface OnboardingState {
  // Step 1: Profile basics
  dob: string;
  sex: Sex;
  height_cm: number;
  current_weight_kg: number;

  // Step 2: Goal
  goal: Goal;
  target_weight_kg: number;
  target_rate_kg_per_week: number;
  activity_level: number;

  // Step 3: Diet
  diet_type: DietType;
  allergies: string[];
  conditions: string[];

  // Step 4: Hostel
  mess_id: string | null;
  canteen_freq: CanteenFreq;
  canteen_typical_spend_inr: number;
  top_up_budget_inr_weekly: number;
  equipment: Equipment[];
  workout_minutes_per_day: number;
  workout_days_per_week: number;
  gym_access_days: DayOfWeek[];

  // Actions
  setField: <K extends keyof OnboardingState>(
    key: K,
    value: OnboardingState[K],
  ) => void;
  /** Apply several fields at once (one render, one persist). */
  patch: (fields: Partial<Omit<OnboardingState, "setField" | "patch" | "reset">>) => void;
  reset: () => void;
}

const defaults: Omit<OnboardingState, "setField" | "patch" | "reset"> = {
  dob: "",
  sex: "male",
  height_cm: 170,
  current_weight_kg: 60,
  goal: "maintain",
  target_weight_kg: 60,
  target_rate_kg_per_week: 0,
  activity_level: 2,
  diet_type: "veg",
  allergies: [],
  conditions: [],
  mess_id: null,
  canteen_freq: "rare",
  canteen_typical_spend_inr: 50,
  top_up_budget_inr_weekly: 200,
  equipment: ["bodyweight"],
  workout_minutes_per_day: 30,
  workout_days_per_week: 3,
  gym_access_days: [],
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...defaults,
      setField: (key, value) => set({ [key]: value } as Partial<OnboardingState>),
      patch: (fields) => set(fields),
      reset: () => set(defaults),
    }),
    {
      name: "onboarding-storage",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

/**
 * Forget everything the user typed, in memory *and* in sessionStorage.
 * Call on sign-out / account deletion / onboarding completion: the store is
 * persisted per tab, so without this the next person to sign up in the same tab
 * would see the previous person's date of birth, weight and conditions.
 */
export function clearOnboardingData(): void {
  useOnboardingStore.getState().reset();
  useOnboardingStore.persist.clearStorage();
}
