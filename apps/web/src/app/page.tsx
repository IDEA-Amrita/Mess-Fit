import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { FlashIcon, BarChartIcon, Shield01Icon } from "@hugeicons/core-free-icons";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "#080808" }}>
      {/* Grid pattern */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* Amber radial glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-0 -translate-x-1/2"
        style={{
          width: "900px",
          height: "500px",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.14) 0%, transparent 68%)",
        }}
      />

      {/* ── Nav ── */}
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-xl font-bold tracking-tight">
          <span style={{ color: "#f0f0f0" }}>Mess</span>
          <span style={{ color: "#f59e0b" }}>Fit</span>
        </span>
        <Link
          href="/auth/login"
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#9a9a9a",
          }}
          onMouseEnter={undefined}
        >
          Sign in
        </Link>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 pb-24 pt-14 text-center">
        {/* Badge */}
        <div
          className="mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide"
          style={{
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.25)",
            color: "#f59e0b",
          }}
        >
          <span>✦</span>
          Built for Indian hostel students
        </div>

        {/* Headline */}
        <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-[72px]">
          <span style={{ color: "#f0f0f0" }}>Stop guessing.</span>
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #d97706 0%, #f59e0b 45%, #fde68a 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Start eating right.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="mb-10 max-w-lg text-base leading-relaxed sm:text-lg"
          style={{ color: "#888" }}
        >
          MessFit builds your perfect plate from what your mess actually serves
          — optimized for your calorie and macro targets, every single day.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3 text-sm font-semibold transition-all hover:brightness-110 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #d97706, #f59e0b)",
              color: "#000",
            }}
          >
            Get started free →
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3 text-sm font-medium transition-colors"
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#9a9a9a",
            }}
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 pb-32">
        <p
          className="mb-8 text-center text-xs font-semibold uppercase tracking-widest"
          style={{ color: "#444" }}
        >
          Everything you need to eat well
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "rgba(245,158,11,0.12)" }}
              >
                <HugeiconsIcon icon={f.icon} size={22} strokeWidth={1.5} color="#f59e0b" />
              </div>
              <h3 className="mb-2 font-semibold" style={{ color: "#f0f0f0" }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 border-t py-8 text-center text-xs"
        style={{ borderColor: "rgba(255,255,255,0.06)", color: "#444" }}
      >
        Built at Amrita University · MessFit © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

const features = [
  {
    icon: FlashIcon,
    title: "Smart Optimizer",
    description:
      "Linear programming engine builds your optimal plate from today's mess menu — hitting calorie and macro goals without the guesswork.",
  },
  {
    icon: BarChartIcon,
    title: "Macro Tracking",
    description:
      "Track calories, protein, carbs, and fat across every meal. Know exactly where you stand, at a glance.",
  },
  {
    icon: Shield01Icon,
    title: "Allergen-Aware",
    description:
      "Flag the foods you avoid. Every plate MessFit builds automatically filters them out, every single time.",
  },
];
