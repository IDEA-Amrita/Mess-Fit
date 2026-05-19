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
    <div
      className="flex min-h-screen flex-col items-center px-4 py-10"
      style={{ background: "#080808" }}
    >
      {/* Logo */}
      <Link href="/" className="mb-8 text-2xl font-bold">
        <span style={{ color: "#f0f0f0" }}>Mess</span>
        <span style={{ color: "#f59e0b" }}>Fit</span>
      </Link>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.path} className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors"
              style={
                i <= currentIdx
                  ? { background: "rgba(245,158,11,0.2)", color: "#f59e0b" }
                  : {
                      background: "rgba(255,255,255,0.05)",
                      color: "#444",
                    }
              }
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-px w-6"
                style={{
                  background:
                    i < currentIdx
                      ? "rgba(245,158,11,0.4)"
                      : "rgba(255,255,255,0.08)",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
