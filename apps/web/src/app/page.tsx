import Link from "next/link";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { FlashIcon, BarChartIcon, Shield01Icon, Dumbbell01Icon } from "@hugeicons/core-free-icons";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* ── Background & Effects ── */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero_composition.png"
          alt="MessFit AI Nutrition and Fitness"
          fill
          priority
          className="object-cover object-top opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
      </div>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-0 z-0 -translate-x-1/2"
        style={{
          width: "900px",
          height: "500px",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.2) 0%, transparent 70%)",
        }}
      />

      {/* ── Nav ── */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-2xl font-black tracking-tighter">
          <span className="text-foreground">Mess</span>
          <span className="text-accent">Fit</span>
        </span>
        <Link
          href="/auth/login"
          className="rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-semibold text-muted-foreground backdrop-blur-md transition-all hover:bg-white/10 hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 pb-24 pt-20 text-center lg:pt-32">
        {/* Badge */}
        <div className="stagger-rise mb-8 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-5 py-2 text-xs font-bold tracking-widest text-accent uppercase backdrop-blur-md">
          <span className="animate-pulse">✦</span>
          Built for Indian hostel students
        </div>

        {/* Headline */}
        <h1 className="stagger-rise mb-6 text-6xl font-extrabold leading-[1.1] tracking-tight sm:text-7xl lg:text-[84px]" style={{ animationDelay: "100ms" }}>
          <span className="text-foreground">Stop guessing.</span>
          <br />
          <span className="bg-gradient-to-br from-accent-dark via-accent to-accent-light bg-clip-text text-transparent drop-shadow-sm">
            Start eating right.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="stagger-rise mb-12 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl" style={{ animationDelay: "200ms" }}>
          The ultimate AI-driven personalized nutrition and fitness engine. We build your perfect plate straight from your mess menu—optimized for your macros.
        </p>

        {/* CTAs */}
        <div className="stagger-rise flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ animationDelay: "300ms" }}>
          <Link
            href="/auth/signup"
            className="group relative flex items-center gap-2 overflow-hidden rounded-2xl bg-accent px-8 py-4 text-sm font-bold text-accent-foreground transition-all hover:scale-105 active:scale-95 shadow-glow"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0" />
            <span className="relative">Start your transformation →</span>
          </Link>
        </div>
      </section>

      {/* ── Features (Bento Grid) ── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-32">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Everything you need to level up.</h2>
          <p className="mt-4 text-muted-foreground">Nutrition, tracking, and workouts integrated into one seamless experience.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {/* Main Feature - Spans 2 cols */}
          <div className="bento-card col-span-1 md:col-span-2 lg:col-span-2 p-8 flex flex-col justify-end min-h-[320px]">
            <div className="absolute inset-0 bg-gradient-to-tr from-accent/20 to-transparent opacity-50" />
            <div className="relative z-10">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20 text-accent backdrop-blur-md">
                <HugeiconsIcon icon={FlashIcon} size={28} strokeWidth={1.5} />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-foreground">AI Plate Optimizer</h3>
              <p className="text-muted-foreground leading-relaxed max-w-md">
                Our linear programming engine automatically builds your optimal plate from today&apos;s mess menu—hitting your calorie and macro goals without the guesswork.
              </p>
            </div>
          </div>

          <div className="bento-card col-span-1 md:col-span-1 lg:col-span-2 p-8 flex flex-col justify-end min-h-[320px]">
            <div className="absolute inset-0 bg-[url('/images/workout_texture.png')] bg-cover bg-center opacity-40 mix-blend-overlay" />
            <div className="relative z-10">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-md">
                <HugeiconsIcon icon={Dumbbell01Icon} size={28} strokeWidth={1.5} />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-foreground">Smart Workouts</h3>
              <p className="text-muted-foreground leading-relaxed">
                Log your sets, rest times, and track progress with our built-in workout companion.
              </p>
            </div>
          </div>

          <div className="bento-card col-span-1 md:col-span-2 lg:col-span-2 p-8 flex flex-col justify-end min-h-[280px]">
             <div className="absolute inset-0 bg-[url('/images/plate_texture.png')] bg-cover bg-center opacity-30 mix-blend-overlay" />
             <div className="relative z-10">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-md">
                <HugeiconsIcon icon={BarChartIcon} size={28} strokeWidth={1.5} />
              </div>
              <h3 className="mb-3 text-xl font-bold text-foreground">Advanced Macro Tracking</h3>
              <p className="text-muted-foreground leading-relaxed">
                Track calories, protein, carbs, and fat dynamically across every meal with intelligent adjustments.
              </p>
            </div>
          </div>

          <div className="bento-card col-span-1 md:col-span-1 lg:col-span-2 p-8 flex flex-col justify-end min-h-[280px]">
            <div className="relative z-10">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-500 backdrop-blur-md">
                <HugeiconsIcon icon={Shield01Icon} size={28} strokeWidth={1.5} />
              </div>
              <h3 className="mb-3 text-xl font-bold text-foreground">Allergen-Aware</h3>
              <p className="text-muted-foreground leading-relaxed">
                Flag the foods you avoid. Every plate MessFit builds automatically filters them out, safely.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 py-12 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Built at Amrita University · MessFit © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
