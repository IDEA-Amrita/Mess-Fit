"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Circular progress ring that draws itself in. `pct` is 0–100 (clamped).
 *
 * Uses `pathLength` (0→1) rather than hand-computed dasharray offsets, so the
 * ring stays correct at any radius/size.
 */
export function ProgressRing({
  pct,
  size = 160,
  stroke = 12,
  color = "var(--accent)",
  delay = 0.3,
  children,
  className,
  label,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  delay?: number;
  children?: ReactNode;
  className?: string;
  /** Accessible description, e.g. "62% of calorie goal". */
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (100 - stroke) / 2;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(clamped)}% complete`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 overflow-visible" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: clamped / 100 }}
          transition={{ duration: 1.4, delay, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
      )}
    </div>
  );
}
