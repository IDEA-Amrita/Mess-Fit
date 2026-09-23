"use client";

import { MotionConfig } from "framer-motion";

/**
 * App-wide motion settings. `reducedMotion="user"` makes every framer-motion
 * component honour the OS "reduce motion" preference automatically: transform
 * animations (x/y/scale) are disabled while opacity fades are kept.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
