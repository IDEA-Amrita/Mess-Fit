import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Compact metric tile: label, big value, optional unit + hint/delta + icon.
 * Used across the dashboard and progress screens.
 */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  accent,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  /** Tint the value + icon with the amber accent (for the "hero" metric). */
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && (
          <span className={cn("shrink-0", accent ? "text-accent" : "text-muted-foreground")}>
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-2xl font-semibold tabular-nums",
            accent ? "text-accent" : "text-foreground",
          )}
        >
          {value}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
