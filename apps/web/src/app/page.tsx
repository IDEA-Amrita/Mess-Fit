"use client";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FlashIcon,
  BarChartIcon,
  Shield01Icon,
  Dumbbell01Icon,
  AiChat01Icon,
  Analytics01Icon,
} from "@hugeicons/core-free-icons";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "#08080a" }}>
      {/* ── Animated gradient mesh background ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Primary amber orb */}
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/4"
          style={{
            width: "clamp(600px, 80vw, 1200px)",
            height: "clamp(400px, 50vh, 800px)",
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 40%, transparent 70%)",
            filter: "blur(40px)",
            animation: "mesh-drift 8s ease-in-out infinite alternate",
          }}
        />
        {/* Secondary blue accent orb */}
        <div
          className="absolute right-0 top-1/3"
          style={{
            width: "400px",
            height: "400px",
            background:
              "radial-gradient(circle, rgba(143,213,255,0.06) 0%, transparent 70%)",
            filter: "blur(60px)",
            animation: "mesh-drift 12s ease-in-out infinite alternate-reverse",
          }}
        />
        {/* Subtle grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      {/* ── Nav ── */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <span className="text-xl font-extrabold tracking-tight">
          <span style={{ color: "#f4f4f5" }}>Mess</span>
          <span style={{ color: "#f59e0b" }}>Fit</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="rounded-full px-5 py-2.5 text-sm font-semibold transition-all"
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#a1a1aa",
              backdropFilter: "blur(12px)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-full px-5 py-2.5 text-sm font-bold transition-all hover:brightness-110"
            style={{
              background: "#f59e0b",
              color: "#1b1304",
            }}
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pb-20 pt-24 text-center lg:pt-36">
        {/* Badge */}
        <div
          className="mb-10 inline-flex items-center gap-2.5 rounded-full px-5 py-2"
          style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.2)",
            backdropFilter: "blur(12px)",
          }}
        >
          <span style={{ color: "#f59e0b", fontSize: "14px" }}>✦</span>
          <span
            style={{
              color: "#f59e0b",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            AI-Powered Nutrition Engine
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: "clamp(40px, 7vw, 80px)",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            marginBottom: "24px",
          }}
        >
          <span style={{ color: "#f4f4f5" }}>Your mess menu.</span>
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #d97706 0%, #f59e0b 40%, #fbbf24 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Your perfect plate.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            color: "#a1a1aa",
            fontSize: "clamp(16px, 2vw, 20px)",
            lineHeight: 1.6,
            maxWidth: "600px",
            letterSpacing: "-0.01em",
            marginBottom: "40px",
          }}
        >
          AI builds your optimal plate from what your hostel mess actually
          serves — personalized for your calorie, macro, and allergen goals.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/auth/signup"
            className="rounded-full px-8 py-4 text-sm font-bold transition-all hover:scale-[1.03] active:scale-95"
            style={{
              background: "#f59e0b",
              color: "#1b1304",
              boxShadow: "0 0 0 1px rgba(245,158,11,0.4), 0 10px 34px -14px rgba(245,158,11,0.4)",
            }}
          >
            Get Started Free →
          </Link>
          <Link
            href="#features"
            className="rounded-full px-8 py-4 text-sm font-semibold transition-all hover:bg-white/5"
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2e2e2",
            }}
          >
            See how it works
          </Link>
        </div>

        {/* Trust metrics */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 lg:gap-12">
          {[
            { value: "500+", label: "Students" },
            { value: "15+", label: "Messes" },
            { value: "AI", label: "Optimized" },
          ].map((m) => (
            <div key={m.label} className="flex flex-col items-center gap-1">
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "#f4f4f5",
                }}
              >
                {m.value}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#a1a1aa",
                }}
              >
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Bento Grid ── */}
      <section
        id="features"
        className="relative z-10 mx-auto max-w-7xl px-6 pb-32 lg:px-8"
      >
        <div className="mb-16 text-center">
          <p
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#a1a1aa",
              marginBottom: "16px",
            }}
          >
            Features
          </p>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "#f4f4f5",
            }}
          >
            Built different.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`glass-card group ${i < 2 ? "lg:col-span-2 lg:row-span-1" : ""}`}
              style={{ minHeight: i < 2 ? "280px" : "240px" }}
            >
              {/* Gradient overlay for large cards */}
              {i < 2 && (
                <div
                  className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-40"
                  style={{
                    background:
                      i === 0
                        ? "radial-gradient(ellipse at bottom right, rgba(245,158,11,0.15) 0%, transparent 60%)"
                        : "radial-gradient(ellipse at bottom left, rgba(143,213,255,0.08) 0%, transparent 60%)",
                  }}
                />
              )}
              <div className="relative z-10 flex h-full flex-col justify-end p-6 lg:p-8">
                <div
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    background: f.iconBg,
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <HugeiconsIcon
                    icon={f.icon}
                    size={24}
                    strokeWidth={1.5}
                    color={f.iconColor}
                  />
                </div>
                <h3
                  style={{
                    fontSize: i < 2 ? "24px" : "20px",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: "#f4f4f5",
                    marginBottom: "8px",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: "15px",
                    lineHeight: 1.6,
                    color: "#a1a1aa",
                    maxWidth: "440px",
                  }}
                >
                  {f.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-32 lg:px-8">
        <div className="mb-16 text-center">
          <p
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#a1a1aa",
              marginBottom: "16px",
            }}
          >
            How it works
          </p>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "#f4f4f5",
            }}
          >
            Three steps. Zero guesswork.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="glass-card relative p-6 text-center">
              <div
                className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.25)",
                }}
              >
                <span
                  style={{
                    color: "#f59e0b",
                    fontSize: "18px",
                    fontWeight: 800,
                  }}
                >
                  {i + 1}
                </span>
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "#f4f4f5",
                  marginBottom: "8px",
                }}
              >
                {s.title}
              </h3>
              <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#a1a1aa" }}>
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 py-12 text-center"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <p
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#a1a1aa",
          }}
        >
          Built at Amrita University · MessFit © {new Date().getFullYear()}
        </p>
      </footer>

      {/* Inline keyframes for gradient mesh animation */}
      <style jsx>{`
        @keyframes mesh-drift {
          0% { transform: translate(-50%, -25%) scale(1); }
          100% { transform: translate(-50%, -20%) scale(1.1); }
        }
        .glass-card {
          position: relative;
          overflow: hidden;
          border-radius: 1.5rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.18);
          box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.6);
        }
      `}</style>
    </div>
  );
}

const features = [
  {
    icon: FlashIcon,
    iconBg: "rgba(245,158,11,0.15)",
    iconColor: "#f59e0b",
    title: "AI Plate Optimizer",
    description:
      "Our linear programming engine builds your optimal plate from today's mess menu — hitting your calorie and macro goals without guesswork.",
  },
  {
    icon: Dumbbell01Icon,
    iconBg: "rgba(143,213,255,0.12)",
    iconColor: "#8fd5ff",
    title: "Smart Workout Logger",
    description:
      "Log sets, track rest times, and monitor progressive overload with an interface designed for the gym floor.",
  },
  {
    icon: BarChartIcon,
    iconBg: "rgba(34,197,94,0.12)",
    iconColor: "#22c55e",
    title: "Macro Dashboard",
    description:
      "Track calories, protein, carbs, and fat dynamically across every meal with real-time adjustments.",
  },
  {
    icon: Shield01Icon,
    iconBg: "rgba(239,68,68,0.12)",
    iconColor: "#ef4444",
    title: "Allergen Shield",
    description:
      "Flag the foods you avoid. Every plate MessFit builds automatically filters them out.",
  },
  {
    icon: AiChat01Icon,
    iconBg: "rgba(168,85,247,0.12)",
    iconColor: "#a855f7",
    title: "AI Coach Chat",
    description:
      "Ask your personal AI nutrition and fitness coach anything — grounded in curated, evidence-based sources.",
  },
  {
    icon: Analytics01Icon,
    iconBg: "rgba(245,158,11,0.12)",
    iconColor: "#fbbf24",
    title: "Progress Analytics",
    description:
      "Weight trends, adaptive TDEE, adherence tracking, and AI-powered projections to keep you on track.",
  },
];

const steps = [
  {
    title: "Tell us your goals",
    description:
      "Set your calorie target, macro split, and flag any allergens during a quick onboarding.",
  },
  {
    title: "We scan the menu",
    description:
      "Our AI reads today's mess menu and runs optimization to find your best possible plate.",
  },
  {
    title: "Get your plate",
    description:
      "See exactly what to eat, how much, and why — with one-tap logging and macro tracking.",
  },
];
