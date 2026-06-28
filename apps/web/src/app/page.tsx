"use client";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "framer-motion";
import {
  FlashIcon,
  BarChartIcon,
  Shield01Icon,
  Dumbbell01Icon,
  AiChat01Icon,
  Analytics01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden selection:bg-accent selection:text-black">
      
      {/* ── Nav ── */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <span className="text-xl font-black tracking-tighter">
          <span className="text-white">MESS</span>
          <span className="text-accent">FIT</span>
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/auth/login"
            className="text-[13px] font-bold text-muted-foreground hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-full bg-accent px-5 py-2.5 text-[13px] font-black uppercase tracking-widest text-black transition-all hover:bg-white"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pb-20 pt-24 text-center lg:pt-36">
        <motion.div initial="hidden" animate="show" variants={containerVariants} className="flex flex-col items-center">
          
          <motion.div variants={itemVariants} className="mb-8">
            <span className="inline-block rounded-full border-2 border-surface-2 bg-surface px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              <span className="text-accent mr-2">✦</span> The Elite Tracker
            </span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="heading-heavy mx-auto max-w-4xl"
            style={{ fontSize: "clamp(48px, 8vw, 96px)", lineHeight: 0.95 }}
          >
            Train hard.<br />
            <span className="text-accent">Eat right.</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-8 max-w-2xl text-[16px] font-medium text-muted-foreground leading-relaxed sm:text-[18px]"
          >
            The world&apos;s most advanced fitness tracker built specifically for hostel mess menus. 
            AI-optimized plates, strict macro tracking, and intelligent workout logging.
          </motion.p>

          <motion.div variants={itemVariants} className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto rounded-full bg-accent px-8 py-4 text-[14px] font-black uppercase tracking-widest text-black transition-transform hover:scale-105 active:scale-95"
            >
              Get Started Free
            </Link>
            <Link
              href="#features"
              className="w-full sm:w-auto rounded-full border-2 border-surface-2 bg-transparent px-8 py-4 text-[14px] font-bold text-white transition-colors hover:bg-surface-2"
            >
              Explore Features
            </Link>
          </motion.div>

          {/* Trust metrics */}
          <motion.div variants={itemVariants} className="mt-20 flex flex-wrap items-center justify-center gap-12 border-t border-border pt-12">
            {[
              { value: "500+", label: "Athletes" },
              { value: "15+", label: "Messes Supported" },
              { value: "100%", label: "Data Driven" },
            ].map((m) => (
              <div key={m.label} className="flex flex-col items-center gap-1">
                <span className="text-3xl font-black tracking-tighter text-white">{m.value}</span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 pb-32 lg:px-8 mt-12">
        <div className="mb-16 text-center">
          <p className="mb-4 text-[11px] font-black uppercase tracking-widest text-accent">Features</p>
          <h2 className="heading-heavy text-4xl sm:text-5xl">Built for athletes.</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              key={f.title}
              className={cn("surface-card-hover group flex flex-col justify-end", i < 2 && "lg:col-span-2 lg:row-span-1")}
              style={{ minHeight: i < 2 ? "320px" : "280px" }}
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-white group-hover:text-accent transition-colors">
                <HugeiconsIcon icon={f.icon} size={24} strokeWidth={2} />
              </div>
              <h3 className="mb-2 text-xl font-bold tracking-tight text-white">{f.title}</h3>
              <p className="text-[14px] font-medium leading-relaxed text-muted-foreground max-w-[400px]">
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-32 lg:px-8">
        <div className="mb-16 text-center">
          <p className="mb-4 text-[11px] font-black uppercase tracking-widest text-accent">How it works</p>
          <h2 className="heading-heavy text-4xl sm:text-5xl">Zero guesswork.</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="surface-card flex flex-col items-center text-center p-8">
              <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border-2 border-surface-2 text-lg font-black text-accent">
                {i + 1}
              </span>
              <h3 className="mb-3 text-lg font-bold tracking-tight text-white">{s.title}</h3>
              <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border py-12 text-center">
        <p className="text-[13px] font-bold text-muted-foreground">
          Built at Amrita University · MessFit © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: FlashIcon,
    title: "AI Plate Optimizer",
    description: "Our linear programming engine builds your optimal plate from today's mess menu — hitting your calorie and macro goals without guesswork.",
  },
  {
    icon: Dumbbell01Icon,
    title: "Smart Workout Logger",
    description: "Log sets, track rest times, and monitor progressive overload with an interface designed for the gym floor.",
  },
  {
    icon: BarChartIcon,
    title: "Macro Dashboard",
    description: "Track calories, protein, carbs, and fat dynamically across every meal with real-time adjustments.",
  },
  {
    icon: Shield01Icon,
    title: "Allergen Shield",
    description: "Flag the foods you avoid. Every plate MessFit builds automatically filters them out.",
  },
  {
    icon: AiChat01Icon,
    title: "AI Coach Chat",
    description: "Ask your personal AI nutrition and fitness coach anything — grounded in curated, evidence-based sources.",
  },
  {
    icon: Analytics01Icon,
    title: "Progress Analytics",
    description: "Weight trends, adaptive TDEE, adherence tracking, and AI-powered projections to keep you on track.",
  },
];

const steps = [
  {
    title: "Tell us your goals",
    description: "Set your calorie target, macro split, and flag any allergens during a quick onboarding.",
  },
  {
    title: "We scan the menu",
    description: "Our AI reads today's mess menu and runs optimization to find your best possible plate.",
  },
  {
    title: "Get your plate",
    description: "See exactly what to eat, how much, and why — with one-tap logging and macro tracking.",
  },
];
