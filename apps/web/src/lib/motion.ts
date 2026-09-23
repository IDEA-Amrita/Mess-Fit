import type { Transition, Variants } from "framer-motion";

/**
 * Shared motion vocabulary. Every animated surface in the app pulls from here
 * so timing and feel stay consistent (and can be tuned in one place).
 *
 * Springs over tweens: springs respond to interruption (a fast route change or
 * re-hover) without the "snap" a duration-based tween produces.
 */
export const spring = {
  /** Default UI motion: cards, list items, sheets. */
  soft: { type: "spring", stiffness: 300, damping: 26 } satisfies Transition,
  /** Small, snappy feedback: buttons, toggles, nav indicator. */
  snappy: { type: "spring", stiffness: 500, damping: 34 } satisfies Transition,
  /** Large surfaces: modals, bottom sheets. */
  sheet: { type: "spring", stiffness: 260, damping: 30 } satisfies Transition,
} as const;

export const ease = {
  /** Fast start, gentle landing — for things entering the screen. */
  out: [0.16, 1, 0.3, 1] as const,
} as const;

/** Parent variant: staggers its `item` children. */
export const stagger = (gap = 0.07, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/** Child variant: rise + fade in. */
export const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: spring.soft },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4, ease: ease.out } },
};
