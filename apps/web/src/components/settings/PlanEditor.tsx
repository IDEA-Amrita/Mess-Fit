"use client";

import { useId, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { ApiError, apiErrorMessage, apiFetch } from "@/lib/api";
import { getMesses } from "@/lib/mess-api";
import { spring } from "@/lib/motion";
import {
  DIET_OPTIONS,
  GOALS,
  HOSTEL_DEFAULTS,
  formsEqual,
  normalizeGoal,
  toHostelPayload,
  toProfilePayload,
  validateBody,
  validateGoal,
  type ProfileForm,
} from "@/lib/profile-form";
import { toast } from "@/lib/toast-store";
import type { HostelContextPayload, ProfilePayload, Targets } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { Notice, NoticeSlot } from "@/components/onboarding/controls";
import {
  BodyFields,
  DietFields,
  GoalFields,
  HostelFields,
  type FormApi,
} from "@/components/onboarding/fields";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * "Your plan": the daily targets plus editors for everything onboarding asked.
 * Before this existed there was no way to change your goal, weight target, diet
 * or mess after onboarding — the profile was write-once.
 */

const PROFILE_KEY = ["profile", "me"] as const;
const HOSTEL_KEY = ["profile", "hostel"] as const;

export function PlanEditor() {
  const queryClient = useQueryClient();
  // One editor open at a time. Body/goal and diet both PUT the whole profile, so
  // two open drafts could overwrite each other's saved changes with stale values.
  const [openId, setOpenId] = useState<string | null>(null);

  const profileQ = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => apiFetch<ProfilePayload>("/api/v1/profile/me"),
  });
  const hostelQ = useQuery({
    queryKey: HOSTEL_KEY,
    queryFn: () => apiFetch<HostelContextPayload>("/api/v1/profile/hostel-context"),
    // A profile with no hostel context is a valid state: fall back to defaults.
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });
  const targetsQ = useQuery({
    queryKey: ["targets"],
    queryFn: () => apiFetch<Targets>("/api/v1/profile/targets"),
  });
  const messesQ = useQuery({ queryKey: ["messes"], queryFn: getMesses, staleTime: 600_000 });

  const hostelMissing = hostelQ.error instanceof ApiError && hostelQ.error.status === 404;
  const server: ProfileForm | null =
    profileQ.data && (hostelQ.data || hostelMissing)
      ? { ...profileQ.data, ...(hostelQ.data ?? HOSTEL_DEFAULTS) }
      : null;

  const failed = profileQ.isError || (hostelQ.isError && !hostelMissing);

  /** A saved profile changes everything derived from it. */
  function invalidateDerived() {
    for (const key of ["plate", "progress", "workout"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  async function saveProfile(v: ProfileForm) {
    const saved = await apiFetch<ProfilePayload>("/api/v1/profile/me", {
      method: "PUT",
      body: JSON.stringify(toProfilePayload(normalizeGoal(v))),
    });
    queryClient.setQueryData(PROFILE_KEY, saved);
    // Wait for the recomputed targets so the summary above updates in the same beat.
    await queryClient.invalidateQueries({ queryKey: ["targets"] });
    invalidateDerived();
  }

  async function saveHostel(v: ProfileForm) {
    const saved = await apiFetch<HostelContextPayload>("/api/v1/profile/hostel-context", {
      method: "PUT",
      body: JSON.stringify(toHostelPayload(v)),
    });
    queryClient.setQueryData(HOSTEL_KEY, saved);
    invalidateDerived();
  }

  const messName = messesQ.data?.find((m) => m.id === server?.mess_id)?.name;

  return (
    <div className="space-y-4">
      <TargetsSummary targets={targetsQ.data} loading={targetsQ.isPending} refreshing={targetsQ.isFetching} />

      {failed ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">Couldn&apos;t load your profile.</p>
          <button
            onClick={() => {
              profileQ.refetch();
              hostelQ.refetch();
            }}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-white/15"
          >
            Retry
          </button>
        </div>
      ) : !server ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading your profile">
          <Skeleton className="h-[72px] rounded-2xl" />
          <Skeleton className="h-[72px] rounded-2xl" />
          <Skeleton className="h-[72px] rounded-2xl" />
        </div>
      ) : (
        <>
          <PlanGroup
            open={openId === "body"}
            onOpenChange={(o) => setOpenId(o ? "body" : null)}
            title="Body & goal"
            summary={bodySummary(server)}
            server={server}
            validate={(v) => validateBody(v) ?? validateGoal(v)}
            problemShownInline
            save={saveProfile}
            successMessage="Goal updated — targets recalculated"
            fields={(api) => (
              <>
                <BodyFields {...api} />
                <div className="h-px bg-border" />
                <GoalFields {...api} />
              </>
            )}
          />
          <PlanGroup
            open={openId === "diet"}
            onOpenChange={(o) => setOpenId(o ? "diet" : null)}
            title="Diet & health"
            summary={dietSummary(server)}
            server={server}
            save={saveProfile}
            successMessage="Diet updated — targets recalculated"
            fields={(api) => <DietFields {...api} />}
          />
          <PlanGroup
            open={openId === "hostel"}
            onOpenChange={(o) => setOpenId(o ? "hostel" : null)}
            title="Mess & training"
            summary={hostelSummary(server, messName)}
            server={server}
            validate={(v) => (v.mess_id ? null : "Please select your mess.")}
            save={saveHostel}
            successMessage="Mess & training updated"
            fields={(api) => <HostelFields {...api} />}
          />
        </>
      )}
    </div>
  );
}

// ─── summaries ──────────────────────────────────────────────────────────

function bodySummary(v: ProfileForm): string {
  const goal = GOALS.find((g) => g.value === v.goal)?.label ?? v.goal;
  const target = v.goal === "maintain" ? "" : ` → ${v.target_weight_kg} kg`;
  return `${v.height_cm} cm · ${v.current_weight_kg} kg · ${goal}${target}`;
}

function dietSummary(v: ProfileForm): string {
  const diet = DIET_OPTIONS.find((d) => d.value === v.diet_type)?.label ?? v.diet_type;
  const parts = [diet];
  if (v.allergies.length) parts.push(`${v.allergies.length} ${v.allergies.length === 1 ? "allergy" : "allergies"}`);
  if (v.conditions.length) parts.push(`${v.conditions.length} ${v.conditions.length === 1 ? "condition" : "conditions"}`);
  return parts.join(" · ");
}

function hostelSummary(v: ProfileForm, messName: string | undefined): string {
  return `${messName ?? "No mess selected"} · ${v.workout_days_per_week} workout ${v.workout_days_per_week === 1 ? "day" : "days"}/week`;
}

// ─── targets ────────────────────────────────────────────────────────────

function TargetsSummary({
  targets,
  loading,
  refreshing,
}: {
  targets: Targets | undefined;
  loading: boolean;
  refreshing: boolean;
}) {
  if (loading) return <Skeleton className="h-28 rounded-3xl" />;
  if (!targets) return null;
  const items = [
    { label: "Calories", value: targets.daily_kcal, unit: "kcal", color: "var(--accent)" },
    { label: "Protein", value: targets.daily_protein_g, unit: "g", color: "#60a5fa" },
    { label: "Carbs", value: targets.daily_carbs_g, unit: "g", color: "#34d399" },
    { label: "Fats", value: targets.daily_fats_g, unit: "g", color: "#f472b6" },
  ];
  return (
    <div className={cn("grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-4", refreshing && "opacity-60")} aria-busy={refreshing}>
      {items.map((t) => (
        <div key={t.label} className="rounded-2xl border border-border bg-surface p-4">
          <p className="label-caps">{t.label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: t.color }}>
            <AnimatedNumber value={t.value} />
            <span className="ml-1 text-sm font-normal text-muted-foreground">{t.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── one editable group ─────────────────────────────────────────────────

function PlanGroup({
  open,
  onOpenChange,
  title,
  summary,
  server,
  validate,
  problemShownInline = false,
  save,
  successMessage,
  fields,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  summary: string;
  server: ProfileForm;
  validate?: (v: ProfileForm) => string | null;
  /** The fields already render this problem next to the control; don't repeat it. */
  problemShownInline?: boolean;
  save: (v: ProfileForm) => Promise<void>;
  successMessage: string;
  fields: (api: FormApi) => ReactNode;
}) {
  const panelId = useId();
  const [draft, setDraft] = useState<ProfileForm>(server);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = open && !formsEqual(draft, server);
  const problem = open ? (validate?.(draft) ?? null) : null;

  const api: FormApi = {
    values: draft,
    set: (key, value) => setDraft((d) => ({ ...d, [key]: value })),
    patch: (fields) => setDraft((d) => ({ ...d, ...fields })),
  };

  function openEditor() {
    setDraft(server); // always start from what is saved
    setError(null);
    onOpenChange(true);
  }

  function close() {
    onOpenChange(false);
    setError(null);
  }

  async function handleSave() {
    if (problem || saving) return;
    setSaving(true);
    setError(null);
    try {
      await save(draft);
      toast.success(successMessage);
      onOpenChange(false);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save your changes"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{summary}</p>
        </div>
        <button
          type="button"
          onClick={open ? close : openEditor}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-white/10"
        >
          {open ? "Close" : "Edit"}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring.snappy} className="flex">
            <HugeiconsIcon icon={ArrowDown01Icon} className="h-3.5 w-3.5" />
          </motion.span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-5 border-t border-border p-4 sm:p-5">
              {fields(api)}

              <NoticeSlot>
                {error && (
                  <Notice tone="error" key="save-error">
                    {error}
                  </Notice>
                )}
                {!error && problem && !problemShownInline && (
                  <Notice tone="warn" key="problem">
                    {problem}
                  </Notice>
                )}
              </NoticeSlot>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={close}
                  disabled={saving}
                  className="rounded-full px-4 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty || !!problem || saving}
                  className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-[13px] font-bold text-accent-foreground transition-[filter,opacity] hover:brightness-110 disabled:opacity-40"
                >
                  {saving && (
                    <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
