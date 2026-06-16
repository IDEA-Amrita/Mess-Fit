"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Onboarding layout — shared wrapper for all 4 steps.
 *
 * Auth protection is handled by middleware (src/middleware.ts).
 * If a guest hits /onboarding/*, middleware redirects to /auth/login.
 * If an onboarded user hits /onboarding/*, middleware redirects to /dashboard.
 * So this layout only renders for authenticated, non-onboarded users.
 */

const steps = [
  { path: "/onboarding/profile", label: "Profile" },
  { path: "/onboarding/goal", label: "Goal" },
  { path: "/onboarding/diet", label: "Diet" },
  { path: "/onboarding/hostel", label: "Hostel" },
];

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentIdx = steps.findIndex((s) => pathname.startsWith(s.path));

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-background px-4 py-10">
      {/* Amber glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, var(--accent-muted) 0%, transparent 70%)",
        }}
      />

      {/* Logo */}
      <Link href="/" className="relative mb-8 text-2xl font-bold">
        <span className="text-foreground">Mess</span>
        <span className="text-accent">Fit</span>
      </Link>

      {/* Step indicator */}
      <div className="relative mb-8 flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.path} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                i <= currentIdx
                  ? "bg-accent-muted text-accent"
                  : "bg-surface-2 text-muted-foreground/60"
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-6 transition-colors ${
                  i < currentIdx ? "bg-accent/40" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="relative w-full max-w-md mf-rise">{children}</div>
    </div>
  );
}
