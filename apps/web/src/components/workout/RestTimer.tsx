"use client";
import { HugeiconsIcon } from "@hugeicons/react";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlusSignIcon, Cancel01Icon } from "@hugeicons/core-free-icons";

/**
 * Full-screen rest countdown shown between sets.
 *
 * Critical correctness detail: the remaining time is always derived from a
 * wall-clock deadline (`Date.now()` delta), never accumulated by ticking a
 * counter. Browsers throttle/pause `setInterval` in backgrounded tabs, so a
 * counter-based timer drifts or freezes when the user switches away. Computing
 * `deadline - Date.now()` on every tick (and on `visibilitychange`) means the
 * displayed value is correct the instant the tab is foregrounded again.
 */
export function RestTimer({
  seconds,
  nextLabel,
  onDone,
}: {
  seconds: number;
  nextLabel?: string;
  onDone: () => void;
}) {
  // Deadline lives in a ref so "add 15s" can extend it without resetting render.
  const deadlineRef = useRef<number>(Date.now() + seconds * 1000);
  const [remainingMs, setRemainingMs] = useState(seconds * 1000);
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    function recompute() {
      const left = deadlineRef.current - Date.now();
      setRemainingMs(left);
      if (left <= 0) finish();
    }

    recompute();
    const id = window.setInterval(recompute, 250);
    // On returning to the tab, recompute immediately rather than waiting a tick.
    document.addEventListener("visibilitychange", recompute);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", recompute);
    };
  }, [finish]);

  const totalMs = seconds * 1000;
  const remaining = Math.max(0, remainingMs);
  const secs = Math.ceil(remaining / 1000);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const pct = totalMs > 0 ? Math.max(0, Math.min(100, (remaining / totalMs) * 100)) : 0;

  // SVG ring geometry.
  const R = 130;
  const C = 2 * Math.PI * R;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 p-6"
      style={{ background: "rgba(8,8,8,0.97)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-label="Rest timer"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "#555" }}>
        Rest
      </p>

      <div className="relative flex items-center justify-center">
        <svg width="300" height="300" className="-rotate-90">
          <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle
            cx="150"
            cy="150"
            r={R}
            fill="none"
            stroke="#ccff00"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct / 100)}
            style={{ transition: "stroke-dashoffset 250ms linear" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-6xl font-bold tabular-nums" style={{ color: "#f0f0f0" }}>
            {mm > 0 ? `${mm}:${ss.toString().padStart(2, "0")}` : ss}
          </span>
          {nextLabel && (
            <span className="mt-2 text-xs" style={{ color: "#555" }}>
              Next: {nextLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            deadlineRef.current += 15_000;
            setRemainingMs(deadlineRef.current - Date.now());
          }}
          className="flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium"
          style={{ borderColor: "rgba(255,255,255,0.1)", color: "#888" }}
        >
          <HugeiconsIcon icon={PlusSignIcon} className="h-4 w-4" />
          15s
        </button>
        <button
          onClick={finish}
          className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold"
          style={{ background: "rgba(204,255,0,0.14)", color: "#ccff00" }}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          Skip rest
        </button>
      </div>
    </div>
  );
}
