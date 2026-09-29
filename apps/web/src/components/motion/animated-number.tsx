"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { animate, useInView, useMotionValue, useReducedMotion } from "framer-motion";

/**
 * Counts up to `value` when it scrolls into view, and tweens between values
 * on later changes (e.g. when a query resolves).
 *
 * Writes straight to the DOM node through a MotionValue subscription, so the
 * count never triggers React re-renders — 60 updates/sec would otherwise
 * re-render the parent tree. Falls back to the final value immediately when the
 * user prefers reduced motion.
 */
export function AnimatedNumber({
  value,
  duration = 1.1,
  format = (n) => Math.round(n).toLocaleString(),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  // Keep the latest formatter without making it an effect dependency (callers
  // usually pass an inline arrow, which would restart the animation each render).
  const formatRef = useRef(format);
  useLayoutEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const unsub = mv.on("change", (v) => {
      node.textContent = formatRef.current(v);
    });
    return unsub;
  }, [mv]);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, value, duration, reduce, mv]);

  return (
    <span ref={ref} className={className}>
      {format(reduce ? value : 0)}
    </span>
  );
}
