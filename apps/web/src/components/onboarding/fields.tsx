"use client";

import { useId, useState } from "react";
import { format as fmtDate } from "date-fns";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getMesses } from "@/lib/mess-api";
import { spring } from "@/lib/motion";
import {
  ACTIVITY_LABELS,
  ALLERGY_OPTIONS,
  BMI_COLORS,
  CANTEEN_OPTIONS,
  CONDITION_OPTIONS,
  DIET_OPTIONS,
  EQUIPMENT_OPTIONS,
  GOALS,
  LIMITS,
  MIN_DOB,
  classifyBmi,
  computeBmi,
  estimateGoal,
  goalPatch,
  isoDate,
  toggleItem,
  validateBody,
  validateGoal,
  type ProfileForm,
} from "@/lib/profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Field, Notice, NoticeSlot, OptionButton, SliderField } from "./controls";

/**
 * The form sections shared by the onboarding steps and the Settings editor.
 * They are controlled: the caller owns the values (zustand in onboarding, local
 * state in Settings) and passes `values` + `set`/`patch`.
 */
export interface FormApi {
  values: ProfileForm;
  set: <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => void;
  patch: (fields: Partial<ProfileForm>) => void;
}

const CHIP = "rounded-lg px-3 py-1.5 text-xs";

// ─── body ───────────────────────────────────────────────────────────────

/** BMI scale: 15 → 35, with the four Asia-Pacific bands and a dot that springs to your value. */
const SCALE_MIN = 15;
const SCALE_MAX = 35;

function BmiMeter({ height, weight }: { height: number; weight: number }) {
  const bmi = computeBmi(height, weight);
  const cls = classifyBmi(bmi);
  const color = BMI_COLORS[cls];
  const pct = Math.min(100, Math.max(0, ((bmi - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100));
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Your BMI</span>
        <span className="font-bold capitalize tabular-nums" style={{ color }}>
          {bmi} · {cls}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full" aria-hidden>
        {/* band widths follow the cutoffs 18.5 / 23 / 25 on the 15–35 scale */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${BMI_COLORS.underweight} 0 17.5%, ${BMI_COLORS.normal} 17.5% 40%, ${BMI_COLORS.overweight} 40% 50%, ${BMI_COLORS.obese} 50% 100%)`,
            opacity: 0.55,
          }}
        />
        <motion.span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black"
          style={{ background: color }}
          initial={false}
          animate={{ left: `${pct}%` }}
          transition={spring.snappy}
        />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground/70">Asia-Pacific cutoffs (WHO 2004).</p>
    </div>
  );
}

export function BodyFields({ values, set, patch }: FormApi) {
  const dobId = useId();
  // An empty date is only an error once the user has touched the field; a fresh
  // form shouldn't open with a red message.
  const [dobTouched, setDobTouched] = useState(false);
  const dobError = values.dob || dobTouched ? validateBody(values) : null;
  return (
    <>
      <Field label="Date of birth" htmlFor={dobId}>
        <input
          id={dobId}
          type="date"
          value={values.dob}
          min={MIN_DOB}
          max={isoDate(new Date())}
          onChange={(e) => {
            setDobTouched(true);
            set("dob", e.target.value);
          }}
          required
          aria-invalid={!!dobError}
          className="scheme-dark rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring"
        />
        <NoticeSlot>{dobError && <Notice tone="error">{dobError}</Notice>}</NoticeSlot>
      </Field>

      <Field label="Biological sex">
        <div className="flex gap-2">
          {(["male", "female", "other"] as const).map((s) => (
            <OptionButton
              key={s}
              active={values.sex === s}
              onClick={() => set("sex", s)}
              className="flex-1 capitalize"
            >
              {s}
            </OptionButton>
          ))}
        </div>
      </Field>

      <SliderField
        label="Height"
        value={values.height_cm}
        min={LIMITS.height.min}
        max={LIMITS.height.max}
        format={(v) => `${v} cm`}
        minLabel={`${LIMITS.height.min} cm`}
        maxLabel={`${LIMITS.height.max} cm`}
        onChange={(v) => set("height_cm", v)}
      />

      <SliderField
        label="Current weight"
        value={values.current_weight_kg}
        min={LIMITS.weight.min}
        max={LIMITS.weight.max}
        step={0.5}
        format={(v) => `${v} kg`}
        minLabel={`${LIMITS.weight.min} kg`}
        maxLabel={`${LIMITS.weight.max} kg`}
        // While the goal is "maintain" the target *is* the current weight; keeping
        // them in step means picking gain/lose later starts from the real weight
        // instead of the store's default.
        onChange={(v) =>
          values.goal === "maintain"
            ? patch({ current_weight_kg: v, target_weight_kg: v })
            : set("current_weight_kg", v)
        }
      />

      <BmiMeter height={values.height_cm} weight={values.current_weight_kg} />
    </>
  );
}

// ─── goal ───────────────────────────────────────────────────────────────

export function GoalFields({ values, set, patch }: FormApi) {
  const layoutId = useId();
  const goalError = validateGoal(values);
  const estimate = estimateGoal(values);
  const rate = Math.abs(values.target_rate_kg_per_week);

  return (
    <>
      <div role="radiogroup" aria-label="Goal" className="flex flex-col gap-2">
        {GOALS.map((g) => {
          const active = values.goal === g.value;
          return (
            <button
              key={g.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => patch(goalPatch(values, g.value))}
              className={cn(
                "relative rounded-xl border px-4 py-3 text-left transition-colors duration-150 active:scale-[0.99]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active ? "border-accent/40" : "border-border bg-surface-2 hover:border-border-strong",
              )}
            >
              {active && (
                <motion.span
                  layoutId={layoutId}
                  aria-hidden
                  className="absolute inset-0 rounded-xl bg-accent-muted"
                  transition={spring.snappy}
                />
              )}
              <span className="relative">
                <span className={cn("text-sm font-semibold", active ? "text-accent" : "text-foreground")}>
                  {g.label}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">{g.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {values.goal !== "maintain" && (
        <>
          <SliderField
            label="Target weight"
            value={values.target_weight_kg}
            min={LIMITS.weight.min}
            max={LIMITS.weight.max}
            step={0.5}
            format={(v) => `${v} kg`}
            onChange={(v) => set("target_weight_kg", v)}
          />

          <SliderField
            label={values.goal === "gain" ? "Weekly gain" : "Weekly loss"}
            value={rate}
            min={LIMITS.rate.min}
            max={LIMITS.rate.max}
            step={0.05}
            format={(v) => `${+v.toFixed(2)} kg/week`}
            minLabel="0.1 (gentle)"
            maxLabel="0.5 (aggressive)"
            onChange={(v) => set("target_rate_kg_per_week", values.goal === "lose" ? -v : v)}
          />

          <NoticeSlot>
            {goalError ? (
              <Notice tone="error" key="err">
                {goalError}
              </Notice>
            ) : (
              estimate && (
                <Notice key="est">
                  About <strong className="text-foreground">{estimate.weeks} weeks</strong> to reach{" "}
                  {values.target_weight_kg} kg — around{" "}
                  <strong className="text-foreground">{fmtDate(estimate.reachedOn, "d MMM yyyy")}</strong>.
                  {estimate.capped && (
                    <>
                      {" "}
                      For safety we cap the daily calorie change at 500 kcal, so the real pace is about{" "}
                      {estimate.effectiveRate.toFixed(2)} kg/week.
                    </>
                  )}
                </Notice>
              )
            )}
          </NoticeSlot>
        </>
      )}

      <SliderField
        label="Activity level"
        value={values.activity_level}
        min={1}
        max={5}
        format={(v) => `${v} / 5`}
        minLabel="Sedentary"
        maxLabel="Very active"
        onChange={(v) => set("activity_level", v)}
      />
      <p className="-mt-3 text-xs text-muted-foreground" aria-live="polite">
        {ACTIVITY_LABELS[values.activity_level]}
      </p>
    </>
  );
}

// ─── diet ───────────────────────────────────────────────────────────────

export function DietFields({ values, set }: FormApi) {
  return (
    <>
      <Field label="Diet type">
        <div className="grid grid-cols-2 gap-2">
          {DIET_OPTIONS.map((d) => (
            <OptionButton key={d.value} active={values.diet_type === d.value} onClick={() => set("diet_type", d.value)}>
              {d.label}
            </OptionButton>
          ))}
        </div>
      </Field>

      <Field label="Allergies (select any that apply)">
        <div className="flex flex-wrap gap-2">
          {ALLERGY_OPTIONS.map((a) => (
            <OptionButton
              key={a}
              tone="danger"
              active={values.allergies.includes(a)}
              onClick={() => set("allergies", toggleItem(values.allergies, a))}
              className={`${CHIP} capitalize`}
            >
              {a}
            </OptionButton>
          ))}
        </div>
      </Field>

      <Field label="Medical conditions (select any that apply)">
        <div className="flex flex-wrap gap-2">
          {CONDITION_OPTIONS.map((c) => (
            <OptionButton
              key={c.value}
              active={values.conditions.includes(c.value)}
              onClick={() => set("conditions", toggleItem(values.conditions, c.value))}
              className={CHIP}
            >
              {c.label}
            </OptionButton>
          ))}
        </div>
      </Field>
    </>
  );
}

// ─── hostel ─────────────────────────────────────────────────────────────

export function HostelFields({ values, set }: FormApi) {
  const messes = useQuery({ queryKey: ["messes"], queryFn: getMesses, staleTime: 600_000 });

  return (
    <>
      <Field
        label={
          <>
            Your mess <span className="text-destructive">*</span>
          </>
        }
      >
        {messes.isPending ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading messes">
            <Skeleton className="h-[62px] rounded-xl" />
            <Skeleton className="h-[62px] rounded-xl" />
          </div>
        ) : messes.isError ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-3">
            <p className="text-xs text-destructive">Couldn&apos;t load the list of messes.</p>
            <button
              type="button"
              onClick={() => messes.refetch()}
              className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-white/15"
            >
              Retry
            </button>
          </div>
        ) : messes.data.length === 0 ? (
          <p className="text-xs text-muted-foreground">No messes are available yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {messes.data.map((m) => {
              const active = values.mess_id === m.id;
              return (
                <OptionButton key={m.id} active={active} onClick={() => set("mess_id", m.id)} className="text-left">
                  {m.name}
                  <span className={cn("block text-xs font-normal", active ? "text-accent/80" : "text-muted-foreground/60")}>
                    {m.college}
                  </span>
                </OptionButton>
              );
            })}
          </div>
        )}
      </Field>

      <Field label="How often do you eat at the canteen?">
        <div className="grid grid-cols-2 gap-2">
          {CANTEEN_OPTIONS.map((c) => (
            <OptionButton key={c.value} active={values.canteen_freq === c.value} onClick={() => set("canteen_freq", c.value)}>
              {c.label}
            </OptionButton>
          ))}
        </div>
      </Field>

      <SliderField
        label="Weekly top-up budget"
        value={values.top_up_budget_inr_weekly}
        min={0}
        max={1000}
        step={50}
        format={(v) => `₹${v}`}
        minLabel="₹0"
        maxLabel="₹1000"
        onChange={(v) => set("top_up_budget_inr_weekly", v)}
      />

      <Field label="Workout equipment available">
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map((eq) => (
            <OptionButton
              key={eq.value}
              active={values.equipment.includes(eq.value)}
              onClick={() => set("equipment", toggleItem(values.equipment, eq.value))}
              className={CHIP}
            >
              {eq.label}
            </OptionButton>
          ))}
        </div>
      </Field>

      <SliderField
        label="Workout days per week"
        value={values.workout_days_per_week}
        min={0}
        max={7}
        format={(v) => `${v} ${v === 1 ? "day" : "days"}`}
        onChange={(v) => set("workout_days_per_week", v)}
      />

      <SliderField
        label="Minutes per session"
        value={values.workout_minutes_per_day}
        min={0}
        max={120}
        step={5}
        format={(v) => `${v} min`}
        onChange={(v) => set("workout_minutes_per_day", v)}
      />
    </>
  );
}
