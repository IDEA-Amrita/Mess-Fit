"use client";

import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Shared form controls for onboarding and the Settings profile editor. They are
 * token-driven so the dark + accent identity stays consistent, and they carry
 * the accessibility wiring (labels, pressed state, live regions) once, instead
 * of each step re-implementing it.
 */

export function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-h2 text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/**
 * A labelled control. With `htmlFor` the label is a real <label> for that
 * input; without it (groups of buttons) the wrapper is a labelled group, which
 * is the correct semantics — a <label> with no control points at nothing.
 */
export function Field({
  label,
  htmlFor,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  const labelId = useId();
  const cls = "text-xs font-medium text-muted-foreground";
  return htmlFor ? (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className={cls}>
        {label}
      </label>
      {children}
    </div>
  ) : (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <span id={labelId} className={cls}>
        {label}
      </span>
      {children}
    </div>
  );
}

/** A selectable chip/card. `tone` keeps the destructive variant for allergies. */
export function OptionButton({
  active,
  tone = "accent",
  className,
  ...props
}: ComponentProps<"button"> & {
  active: boolean;
  tone?: "accent" | "danger";
}) {
  const tones = {
    accent: active
      ? "border-accent/40 bg-accent-muted text-accent"
      : "border-border bg-surface-2 text-muted-foreground hover:border-border-strong hover:text-foreground",
    danger: active
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-border bg-surface-2 text-muted-foreground hover:border-border-strong hover:text-foreground",
  } as const;
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.97]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Range slider. The filled part of the track is drawn from `--pct` (see the
 * `.mf-range` rules in globals.css) so it reads as progress, not just a thumb.
 */
export function RangeInput({ className, style, ...props }: ComponentProps<"input">) {
  const min = Number(props.min ?? 0);
  const max = Number(props.max ?? 100);
  const value = Number(props.value ?? min);
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      {...props}
      style={{ ...style, "--pct": `${Math.min(100, Math.max(0, pct))}%` } as CSSProperties}
      className={cn("mf-range w-full", className)}
    />
  );
}

/**
 * Label + live value + slider + min/max captions. `format` renders the value
 * shown on the right (and read out to screen readers via aria-valuetext).
 */
export function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = String,
  minLabel,
  maxLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  minLabel?: string;
  maxLabel?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <output htmlFor={id} className="text-sm font-bold tabular-nums text-accent">
          {format(value)}
        </output>
      </div>
      <RangeInput
        id={id}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-xs text-muted-foreground/60">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Inline message under a control. Announced to screen readers when it appears
 * (role="alert" for problems, polite status for hints).
 */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "error";
  children: ReactNode;
}) {
  const tones = {
    info: "border-border bg-surface-2 text-muted-foreground",
    warn: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    error: "border-destructive/25 bg-destructive/10 text-destructive",
  } as const;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      // Springs settle slowly; a quick tween on the way out keeps the layout from lagging.
      exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
      transition={spring.soft}
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-3 py-2 text-xs leading-relaxed", tones[tone])}
    >
      {children}
    </motion.p>
  );
}

/** Mounts/unmounts a <Notice> with an enter and exit animation. */
export function NoticeSlot({ children }: { children: ReactNode }) {
  return <AnimatePresence initial={false}>{children}</AnimatePresence>;
}

/** Back (optional) + primary submit footer shared by the step forms. */
export function StepActions({
  onBack,
  nextLabel = "Next →",
  disabled,
  pending,
}: {
  onBack?: () => void;
  nextLabel?: string;
  disabled?: boolean;
  /** Shows a spinner and blocks re-submission while a save is in flight. */
  pending?: boolean;
}) {
  return (
    <div className="mt-1 flex gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          ← Back
        </button>
      )}
      <motion.button
        type="submit"
        disabled={disabled || pending}
        whileTap={{ scale: 0.98 }}
        transition={spring.snappy}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--accent-dark),var(--accent))] py-3 text-sm font-semibold text-primary-foreground transition-[filter,opacity] hover:brightness-110 disabled:opacity-50"
      >
        {pending && (
          <span
            aria-hidden
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {nextLabel}
      </motion.button>
    </div>
  );
}
