"use client";

import Link from "next/link";
import { motion, useScroll, useSpring, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HeroMock } from "@/components/landing/hero-mock";
import { Bento } from "@/components/landing/bento";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { item } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Typical mess-menu dishes. Purely decorative ticker — no claims attached.
const DISHES = [
  "Idli", "Sambar", "Rajma masala", "Jeera rice", "Dal tadka", "Paneer butter masala",
  "Chapati", "Curd rice", "Poha", "Upma", "Chole", "Egg curry", "Aloo gobi", "Rasam",
];

const STEPS = [
  {
    title: "Tell us your goals",
    description: "Set your calorie target and macro split, and flag any allergens, in a quick onboarding.",
  },
  {
    title: "We read the menu",
    description: "Your mess's menu goes in; the optimizer works out the best combination and portions.",
  },
  {
    title: "Eat your plate",
    description: "See exactly what to eat, how much and why — then log it in one tap and watch your streak grow.",
  },
];

export default function LandingPage() {
  const { scrollYProgress, scrollY } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28 });
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background selection:bg-accent selection:text-black">
      {/* Scroll progress */}
      <motion.div
        aria-hidden
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-accent shadow-[0_0_10px_var(--accent)]"
      />

      {/* ── Nav (turns to frosted glass once you scroll) ── */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-all duration-300",
          scrolled ? "border-b border-border/60 bg-background/70 backdrop-blur-xl" : "border-b border-transparent",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <span className="text-xl font-black tracking-tighter">
            <span className="text-white">MESS</span>
            <span className="text-accent">FIT</span>
          </span>
          <nav className="flex items-center gap-5">
            <a href="#features" className="hidden text-[13px] font-bold text-muted-foreground transition-colors hover:text-white sm:block">
              Features
            </a>
            <a href="#how" className="hidden text-[13px] font-bold text-muted-foreground transition-colors hover:text-white sm:block">
              How it works
            </a>
            <Link href="/auth/login" className="text-[13px] font-bold text-muted-foreground transition-colors hover:text-white">
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-full bg-accent px-5 py-2.5 text-[12px] font-black uppercase tracking-widest text-black transition-all hover:bg-white active:scale-95"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 pb-24 pt-36 lg:grid-cols-2 lg:px-8 lg:pt-44">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10" />
        <div
          aria-hidden
          className="animate-drift pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-3xl"
        />

        <Stagger onMount gap={0.1} className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <StaggerItem>
            <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              Built for hostel mess menus
            </span>
          </StaggerItem>

          <StaggerItem>
            <h1 className="heading-heavy max-w-xl" style={{ fontSize: "clamp(44px, 7vw, 84px)", lineHeight: 0.95 }}>
              <span className="text-gradient">Train hard.</span>
              <br />
              <span className="text-accent">Eat right.</span>
            </h1>
          </StaggerItem>

          <StaggerItem>
            <p className="mt-7 max-w-lg text-[16px] font-medium leading-relaxed text-muted-foreground sm:text-[18px]">
              Hit your calorie and macro targets from the food your mess actually serves — with an optimizer that
              builds the plate, and a tracker that keeps you honest.
            </p>
          </StaggerItem>

          <StaggerItem className="mt-10 flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
            <Link
              href="/auth/signup"
              className="group flex w-full items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 text-[14px] font-black uppercase tracking-widest text-black transition-transform hover:scale-[1.03] active:scale-95 sm:w-auto"
            >
              Get Started Free
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={2.5} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className="w-full rounded-full border-2 border-surface-2 px-8 py-4 text-center text-[14px] font-bold text-white transition-colors hover:bg-surface-2 sm:w-auto"
            >
              Explore Features
            </a>
          </StaggerItem>
        </Stagger>

        <HeroMock />
      </section>

      {/* ── Dish ticker ── */}
      <section aria-hidden className="marquee-mask overflow-hidden border-y border-border/60 py-5">
        <div className="animate-marquee flex w-max gap-10 whitespace-nowrap">
          {[...DISHES, ...DISHES].map((d, i) => (
            <span key={i} className="flex items-center gap-10 text-[13px] font-bold uppercase tracking-widest text-muted-foreground/70">
              {d}
              <span className="text-accent">✦</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-6 py-28 lg:px-8">
        <Reveal className="mb-14 text-center">
          <p className="mb-4 text-[11px] font-black uppercase tracking-widest text-accent">Features</p>
          <h2 className="heading-heavy text-4xl sm:text-5xl">Everything an athlete needs.</h2>
        </Reveal>
        <Bento />
      </section>

      {/* ── How it works ── */}
      <section id="how" className="mx-auto max-w-5xl scroll-mt-20 px-6 pb-28 lg:px-8">
        <Reveal className="mb-14 text-center">
          <p className="mb-4 text-[11px] font-black uppercase tracking-widest text-accent">How it works</p>
          <h2 className="heading-heavy text-4xl sm:text-5xl">Zero guesswork.</h2>
        </Reveal>

        <Stagger gap={0.15} className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Connector line that draws across the steps on desktop */}
          <motion.div
            aria-hidden
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-[16%] right-[16%] top-14 hidden h-px origin-left bg-gradient-to-r from-accent/0 via-accent/60 to-accent/0 md:block"
          />
          {STEPS.map((s, i) => (
            <motion.div key={s.title} variants={item} className="surface-card relative flex flex-col items-center p-8 text-center">
              <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border-2 border-accent/40 bg-background text-lg font-black text-accent">
                {i + 1}
              </span>
              <h3 className="mb-3 text-lg font-bold tracking-tight text-white">{s.title}</h3>
              <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">{s.description}</p>
            </motion.div>
          ))}
        </Stagger>
      </section>

      {/* ── Final CTA ── */}
      <section className="mx-auto max-w-5xl px-6 pb-28 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-border bg-surface px-8 py-16 text-center">
            <div aria-hidden className="animate-drift absolute left-1/2 top-0 h-56 w-[28rem] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
            <h2 className="heading-heavy relative text-4xl sm:text-5xl">Your next meal, optimised.</h2>
            <p className="relative mx-auto mt-4 max-w-md text-[15px] font-medium text-muted-foreground">
              Set up takes a couple of minutes. Your first plate is one menu away.
            </p>
            <Link
              href="/auth/signup"
              className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-[14px] font-black uppercase tracking-widest text-black transition-transform hover:scale-[1.03] active:scale-95"
            >
              Get Started Free
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={2.5} />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
