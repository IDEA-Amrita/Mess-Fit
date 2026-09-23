"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { item, stagger } from "@/lib/motion";

/** Rises + fades in the first time it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      variants={item}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggers direct `<StaggerItem>` children as the group scrolls into view
 * (or on mount with `onMount`).
 */
export function Stagger({
  children,
  gap,
  delay,
  onMount,
  className,
}: {
  children: ReactNode;
  gap?: number;
  delay?: number;
  onMount?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      variants={stagger(gap, delay)}
      initial="hidden"
      {...(onMount
        ? { animate: "show" }
        : { whileInView: "show", viewport: { once: true, margin: "-60px" } })}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}
