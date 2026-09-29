"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { spring } from "@/lib/motion";

const EXTEND_MS = 15_000;
const R = 130;
const CIRCUMFERENCE = 2 * Math.PI * R;

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
  // Deadline lives in a ref so "+15s" can extend it without resetting the timer.
  // Set when the countdown starts (below), not during render: reading the clock
  // while rendering makes the component impure.
  const deadlineRef = useRef<number | null>(null);
  const [totalMs, setTotalMs] = useState(seconds * 1000);
  const [remainingMs, setRemainingMs] = useState(seconds * 1000);
  const finishedRef = useRef(false);
  const skipRef = useRef<HTMLButtonElement>(null);

  // Parents usually pass an inline arrow; keep the latest one in a ref so a
  // parent re-render doesn't tear down and rebuild the interval below.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const finish = useCallback((natural: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // Nudge the user when the rest ends on its own — they're probably not
    // looking at the screen. Feature-detected; a no-op on iOS/desktop.
    if (natural) {
      try {
        navigator.vibrate?.([180, 80, 180]);
      } catch {
        /* ignore */
      }
    }
    onDoneRef.current();
  }, []);

  useEffect(() => {
    deadlineRef.current ??= Date.now() + seconds * 1000;
    const deadline = deadlineRef;
    function recompute() {
      const left = (deadline.current ?? 0) - Date.now();
      setRemainingMs(left);
      if (left <= 0) finish(true);
    }
    recompute();
    const id = window.setInterval(recompute, 250);
    // On returning to the tab, recompute immediately rather than waiting a tick.
    document.addEventListener("visibilitychange", recompute);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", recompute);
    };
  }, [finish, seconds]);

  useEffect(() => {
    skipRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [finish]);

  const remaining = Math.max(0, remainingMs);
  const secs = Math.ceil(remaining / 1000);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const pct = totalMs > 0 ? Math.max(0, Math.min(100, (remaining / totalMs) * 100)) : 0;
  const closing = secs > 0 && secs <= 3;

  function extend() {
    const deadline = (deadlineRef.current ?? Date.now()) + EXTEND_MS;
    deadlineRef.current = deadline;
    // Grow the ring's denominator too, otherwise it sits at 100% for the
    // first 15s after tapping +15s instead of draining smoothly.
    setTotalMs((t) => t + EXTEND_MS);
    setRemainingMs(deadline - Date.now());
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-black/95 p-6 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="Rest timer"
    >
      <p className="label-caps tracking-[0.2em]">Rest</p>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring.sheet}
        className="relative flex items-center justify-center"
      >
        <svg width="300" height="300" className="-rotate-90" aria-hidden>
          <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle
            cx="150"
            cy="150"
            r={R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - pct / 100)}
            style={{ transition: "stroke-dashoffset 250ms linear", filter: "drop-shadow(0 0 8px var(--accent))" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <motion.span
            key={closing ? secs : "steady"}
            animate={closing ? { scale: [1, 1.1, 1] } : { scale: 1 }}
            transition={{ duration: 0.4 }}
            role="timer"
            className="text-6xl font-bold tabular-nums text-white"
          >
            {mm > 0 ? `${mm}:${ss.toString().padStart(2, "0")}` : ss}
          </motion.span>
          {nextLabel && <span className="mt-2 text-xs text-muted-foreground">Next: {nextLabel}</span>}
        </div>
      </motion.div>

      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={extend}
          className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-white"
        >
          <HugeiconsIcon icon={PlusSignIcon} className="h-4 w-4" />
          15s
        </motion.button>
        <motion.button
          ref={skipRef}
          whileTap={{ scale: 0.95 }}
          onClick={() => finish(false)}
          className="flex items-center gap-1.5 rounded-xl bg-accent/15 px-5 py-2.5 text-sm font-semibold text-accent"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          Skip rest
        </motion.button>
      </div>
    </motion.div>
  );
}
