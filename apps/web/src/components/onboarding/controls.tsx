"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared onboarding controls. The 4 step forms repeated the same heading,
 * labelled field, selectable option button, and back/next footer with inline
 * hex everywhere — these token-driven primitives replace that duplication so
 * the dark + amber identity stays consistent and re-themes from globals.css.
 */

export function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-h2 text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
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
      : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
    danger: active
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
  } as const;
  return (
    <button
      type="button"
      className={cn(
        "rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Amber range slider styled off the accent token. */
export function RangeInput(props: ComponentProps<"input">) {
  return (
    <input
      type="range"
      {...props}
      className={cn("w-full accent-[var(--accent)]", props.className)}
    />
  );
}

/** Back (optional) + primary submit footer shared by the step forms. */
export function StepActions({
  onBack,
  nextLabel = "Next →",
  disabled,
}: {
  onBack?: () => void;
  nextLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mt-1 flex gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back
        </button>
      )}
      <button
        type="submit"
        disabled={disabled}
        className="flex-1 rounded-xl bg-[linear-gradient(135deg,var(--accent-dark),var(--accent))] py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
      >
        {nextLabel}
      </button>
    </div>
  );
}
