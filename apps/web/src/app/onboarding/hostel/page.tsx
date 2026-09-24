"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { track } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";
import { useOnboardingStore } from "@/lib/onboarding-store";
import {
  normalizeGoal,
  toHostelPayload,
  toProfilePayload,
  validateBody,
  validateGoal,
} from "@/lib/profile-form";
import type { Equipment, HostelContextPayload, ProfilePayload } from "@/lib/types";
import { HostelFields } from "@/components/onboarding/fields";
import { Notice, NoticeSlot, StepActions, StepHeading } from "@/components/onboarding/controls";
import { useOnboardingForm } from "@/components/onboarding/use-onboarding-form";

export default function HostelStep() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useOnboardingForm();
  const { values } = form;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // This step doubles as "update my mess" for users who already finished
  // onboarding (see middleware). For them the earlier steps are off-limits, so
  // "Back" must not point at them.
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Re-entry ("update my mess"): pre-populate the store from the API so saving
    // doesn't overwrite the user's real profile with the store's defaults.
    // Skipped for first-time users — they have nothing saved yet, and the two
    // guaranteed 404s would each be reported to Sentry as an error.
    async function loadExisting() {
      const [profileResult, hostelResult] = await Promise.allSettled([
        apiFetch<ProfilePayload & { activity_level: number }>("/api/v1/profile/me"),
        apiFetch<HostelContextPayload>("/api/v1/profile/hostel-context"),
      ]);
      if (cancelled) return;
      const { patch } = useOnboardingStore.getState();
      if (profileResult.status === "fulfilled") {
        const p = profileResult.value;
        patch({
          dob: p.dob,
          sex: p.sex,
          height_cm: p.height_cm,
          current_weight_kg: p.current_weight_kg,
          target_weight_kg: p.target_weight_kg,
          target_rate_kg_per_week: p.target_rate_kg_per_week,
          goal: p.goal,
          activity_level: p.activity_level,
          diet_type: p.diet_type,
          allergies: p.allergies,
          conditions: p.conditions,
        });
      }
      if (hostelResult.status === "fulfilled") {
        const h = hostelResult.value;
        patch({
          mess_id: h.mess_id,
          canteen_freq: h.canteen_freq,
          canteen_typical_spend_inr: h.canteen_typical_spend_inr,
          top_up_budget_inr_weekly: h.top_up_budget_inr_weekly,
          equipment: h.equipment as Equipment[],
          workout_minutes_per_day: h.workout_minutes_per_day,
          workout_days_per_week: h.workout_days_per_week,
          gym_access_days: h.gym_access_days,
        });
      }
    }
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const isOnboarded = Boolean(data.user?.user_metadata?.onboarded);
      setOnboarded(isOnboarded);
      if (isOnboarded) loadExisting().catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.mess_id) {
      setError("Please select your mess to continue.");
      return;
    }
    // Earlier steps validate too, but the user can reach this URL directly.
    const problem = validateBody(values) ?? validateGoal(values);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const final = normalizeGoal(values);
      // Both PUTs are upserts, so a retry after a partial failure is safe.
      await apiFetch("/api/v1/profile/me", {
        method: "PUT",
        body: JSON.stringify(toProfilePayload(final)),
      });
      await apiFetch("/api/v1/profile/hostel-context", {
        method: "PUT",
        body: JSON.stringify(toHostelPayload(final)),
      });

      // Mark onboarding complete in Supabase user metadata, then refresh so the
      // new JWT (which the middleware reads) carries onboarded=true.
      const { error: updateErr } = await supabase.auth.updateUser({ data: { onboarded: true } });
      if (updateErr) throw new Error(updateErr.message);
      await supabase.auth.refreshSession();

      // Anything derived from the profile is now out of date.
      await queryClient.invalidateQueries({ queryKey: ["targets"] });
      queryClient.invalidateQueries({ queryKey: ["plate"] });

      if (!onboarded) track("onboarding_completed");
      router.push("/onboarding/targets");
    } catch (err: unknown) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <StepHeading title="Hostel context" description="Your mess, canteen access, and workout setup." />

      <HostelFields {...form} />

      <NoticeSlot>{error && <Notice tone="error">{error}</Notice>}</NoticeSlot>

      <StepActions
        onBack={() => router.push(onboarded ? "/dashboard/settings" : "/onboarding/diet")}
        pending={submitting}
        nextLabel={submitting ? "Saving…" : onboarded ? "Save & see my targets →" : "See my targets →"}
      />
    </form>
  );
}
