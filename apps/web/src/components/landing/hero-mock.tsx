"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, FlashIcon } from "@hugeicons/core-free-icons";
import { ProgressRing } from "@/components/motion/progress-ring";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { spring } from "@/lib/motion";

// Illustrative sample only — not real user data. Labelled as such in the UI.
const PLATE = [
  { name: "Rajma masala", detail: "1.5 katori", kcal: 236, protein: 12 },
  { name: "Jeera rice", detail: "1 katori", kcal: 210, protein: 4 },
  { name: "Curd", detail: "1 katori", kcal: 98, protein: 6 },
];

/**
 * Product preview shown in the hero: a plate card with a self-drawing ring,
 * plus two floating chips that drift at different speeds as you scroll
 * (parallax) to give the composition depth.
 */
export function HeroMock() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yA = useTransform(scrollYProgress, [0, 1], [30, -50]);
  const yB = useTransform(scrollYProgress, [0, 1], [-10, 60]);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-md">
      {/* Glow */}
      <div aria-hidden className="animate-drift absolute -inset-8 -z-10 rounded-full bg-accent/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 40, rotateX: 12 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ ...spring.sheet, delay: 0.5 }}
        style={{ transformPerspective: 1200 }}
        className="rounded-[2rem] border border-border bg-surface/90 p-6 shadow-2xl backdrop-blur"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="label-caps text-accent">Today&apos;s lunch</p>
            <p className="mt-1 text-lg font-black tracking-tight text-white">Optimised plate</p>
          </div>
          <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Sample
          </span>
        </div>

        <div className="flex items-center gap-5">
          <ProgressRing pct={92} size={112} stroke={11} delay={0.9} label="92% of the lunch calorie target">
            <AnimatedNumber value={544} className="text-xl font-black tabular-nums text-white" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">kcal</span>
          </ProgressRing>

          <ul className="flex-1 space-y-2.5">
            {PLATE.map((d, i) => (
              <motion.li
                key={d.name}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...spring.soft, delay: 0.9 + i * 0.12 }}
                className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-white">{d.name}</p>
                  <p className="text-[11px] font-medium text-muted-foreground">{d.detail}</p>
                </div>
                <span className="ml-3 shrink-0 text-[12px] font-black tabular-nums text-accent">{d.protein}g P</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </motion.div>

      {/* Floating chips (hidden on small screens where they'd overflow) */}
      <motion.div
        style={{ y: yA }}
        className="absolute -top-5 right-10 hidden items-center gap-2 rounded-2xl border border-border bg-popover px-3 py-2 shadow-xl sm:flex"
      >
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} className="text-accent" />
        <span className="text-[12px] font-bold text-white">Nut-free ✓</span>
      </motion.div>
      <motion.div
        style={{ y: yB }}
        className="absolute -bottom-5 left-8 hidden items-center gap-2 rounded-2xl border border-border bg-popover px-3 py-2 shadow-xl sm:flex"
      >
        <HugeiconsIcon icon={FlashIcon} size={18} className="text-[#FF9F0A]" />
        <span className="text-[12px] font-bold text-white">Solver: Optimal</span>
      </motion.div>
    </div>
  );
}
