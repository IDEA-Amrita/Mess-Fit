import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard page heading: optional eyebrow, an h1 on the type scale, an optional
 * one-line description, and a right-aligned actions slot. Token-driven.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="text-h1 text-foreground">{title}</h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
