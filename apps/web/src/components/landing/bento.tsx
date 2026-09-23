"use client";

import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FlashIcon,
  Dumbbell01Icon,
  BarChartIcon,
  Shield01Icon,
  AiChat01Icon,
  Analytics01Icon,
} from "@hugeicons/core-free-icons";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { ProgressRing } from "@/components/motion/progress-ring";
import { cn } from "@/lib/utils";

type Tile = {
  icon: typeof FlashIcon;
  title: string;
  description: string;
  span: string;
  visual: React.ReactNode;
};

const ALLERGENS = ["Peanuts", "Gluten", "Dairy", "Eggs"];

/** Tiny illustrative visuals — decorative, so hidden from assistive tech. */
const TILES: Tile[] = [
  {
    icon: FlashIcon,
    title: "AI Plate Optimizer",
    description:
      "A linear-programming solver builds your best plate from today's mess menu — hitting calories and macros without guesswork.",
    span: "lg:col-span-2",
    visual: (
      <div className="flex items-end gap-2" aria-hidden>
        {[38, 64, 48, 88, 72, 100].map((h, i) => (
          <motion.span
            key={i}
            initial={{ height: 0 }}
            whileInView={{ height: `${h}px` }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 + i * 0.07, type: "spring", stiffness: 160, damping: 18 }}
            className={cn("w-7 rounded-t-lg", i === 5 ? "bg-accent" : "bg-surface-2")}
          />
        ))}
      </div>
    ),
  },
  {
    icon: BarChartIcon,
    title: "Macro Dashboard",
    description: "Calories, protein, carbs and fat across every meal, updating as you log.",
    span: "",
    visual: (
      <ProgressRing pct={74} size={84} stroke={11} label="Example macro ring at 74%">
        <span className="text-sm font-black text-white">74%</span>
      </ProgressRing>
    ),
  },
  {
    icon: Shield01Icon,
    title: "Allergen Shield",
    description: "Flag what you avoid. Every plate MessFit builds filters it out automatically.",
    span: "",
    visual: (
      <div className="flex flex-wrap gap-1.5" aria-hidden>
        {ALLERGENS.map((a, i) => (
          <motion.span
            key={a}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.08 }}
            className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-muted-foreground line-through decoration-accent decoration-2"
          >
            {a}
          </motion.span>
        ))}
      </div>
    ),
  },
  {
    icon: AiChat01Icon,
    title: "AI Coach Chat",
    description:
      "Ask your nutrition and fitness coach anything — answers are grounded in curated sources and link back to them.",
    span: "lg:col-span-2",
    visual: (
      <div className="space-y-2" aria-hidden>
        <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[12px] font-bold text-black">
          How much protein do I need to gain?
        </div>
        <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2 text-[12px] font-medium text-white">
          Aim for about 1.6–2.2 g per kg of body weight<span className="animate-caret ml-0.5 text-accent">▍</span>
        </div>
      </div>
    ),
  },
  {
    icon: Dumbbell01Icon,
    title: "Smart Workout Logger",
    description: "Log sets, run the rest timer, and track progressive overload — built for the gym floor.",
    span: "",
    visual: (
      <div className="flex items-center gap-2" aria-hidden>
        {[8, 8, 7].map((r, i) => (
          <span key={i} className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-[13px] font-black text-white">
            {r}
          </span>
        ))}
        <span className="text-[11px] font-bold text-muted-foreground">reps</span>
      </div>
    ),
  },
  {
    icon: Analytics01Icon,
    title: "Progress Analytics",
    description: "Weight trends, adaptive TDEE and adherence tracking — so you know if it's actually working.",
    span: "lg:col-span-2",
    visual: (
      <svg viewBox="0 0 120 40" className="h-10 w-full" aria-hidden>
        <motion.path
          d="M2 32 C 20 30, 26 20, 42 22 S 70 12, 84 14 S 108 4, 118 6"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
      </svg>
    ),
  },
];

export function Bento() {
  return (
    <Stagger gap={0.08} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {TILES.map((t) => (
        <StaggerItem key={t.title} className={t.span}>
          <SpotlightCard className="surface-card-hover flex h-full min-h-[260px] flex-col justify-between">
            <div className="mb-8">{t.visual}</div>
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-white transition-colors group-hover/spot:text-accent">
                <HugeiconsIcon icon={t.icon} size={20} strokeWidth={2} />
              </div>
              <h3 className="mb-1.5 text-lg font-bold tracking-tight text-white">{t.title}</h3>
              <p className="max-w-[420px] text-[13px] font-medium leading-relaxed text-muted-foreground">{t.description}</p>
            </div>
          </SpotlightCard>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
