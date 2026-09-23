"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick01Icon } from "@hugeicons/core-free-icons";
import { clearOnboardingData } from "@/lib/onboarding-store";
import { spring } from "@/lib/motion";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/**
 * Onboarding layout — shared wrapper for all 4 steps (+ the targets summary).
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

/** The summary screen after the last step: every step is complete. */
const DONE = steps.length;

function stepIndex(pathname: string): number {
  if (pathname.startsWith("/onboarding/targets")) return DONE;
  return steps.findIndex((s) => pathname.startsWith(s.path));
}

function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Onboarding progress" className="relative mb-8 w-full max-w-md">
      <ol className="flex items-start">
        {steps.map((step, i) => {
          const complete = i < current;
          const active = i === current;
          return (
            <li key={step.path} className={cn("flex items-start", i < steps.length - 1 && "flex-1")}>
              <div className="flex w-14 flex-col items-center gap-1.5" aria-current={active ? "step" : undefined}>
                <motion.div
                  initial={false}
                  animate={{ scale: active ? 1.08 : 1 }}
                  transition={spring.snappy}
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors duration-300",
                    complete && "border-accent bg-accent text-accent-foreground",
                    active && "border-accent/60 bg-accent-muted text-accent",
                    !complete && !active && "border-border bg-surface-2 text-muted-foreground/60",
                  )}
                >
                  {complete ? (
                    <motion.span
                      key="tick"
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={spring.snappy}
                      className="flex"
                    >
                      <HugeiconsIcon icon={Tick01Icon} className="h-4 w-4" />
                    </motion.span>
                  ) : (
                    i + 1
                  )}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-0 animate-ping rounded-full border border-accent/40 [animation-iteration-count:2]"
                    />
                  )}
                </motion.div>
                <span
                  className={cn(
                    "text-[11px] font-medium transition-colors",
                    complete || active ? "text-foreground" : "text-muted-foreground/60",
                  )}
                >
                  {step.label}
                  <span className="sr-only">{complete ? " (completed)" : active ? " (current step)" : ""}</span>
                </span>
              </div>
              {i < steps.length - 1 && (
                <div aria-hidden className="relative mt-4 h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                  <motion.div
                    className="absolute inset-0 origin-left bg-accent"
                    initial={false}
                    animate={{ scaleX: i < current ? 1 : 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = stepIndex(pathname);

  // Slide direction follows navigation: forward slides in from the right, back
  // from the left. Derived during render (not in an effect) so the very first
  // paint of a new step already has the right direction.
  const [nav, setNav] = useState({ pathname, dir: 1 });
  if (nav.pathname !== pathname) {
    setNav({ pathname, dir: stepIndex(pathname) >= stepIndex(nav.pathname) ? 1 : -1 });
  }

  // Move focus into the new step so keyboard/screen-reader users land on it.
  const contentRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    contentRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    clearOnboardingData();
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-x-hidden bg-background px-4 py-10">
      {/* Accent glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-0 h-[400px] w-[600px] max-w-full -translate-x-1/2"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, var(--accent-muted) 0%, transparent 70%)",
        }}
      />

      <Link href="/" className="relative mb-8 text-2xl font-bold">
        <span className="text-foreground">Mess</span>
        <span className="text-accent">Fit</span>
      </Link>

      <Stepper current={current} />

      <motion.div
        key={pathname}
        ref={contentRef}
        tabIndex={-1}
        initial={{ opacity: 0, x: nav.dir * 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={spring.soft}
        className="relative w-full max-w-md outline-none"
      >
        {children}
      </motion.div>

      <p className="relative mt-10 text-center text-xs text-muted-foreground/70">
        {email ? <>Signed in as {email}. </> : null}
        <button type="button" onClick={signOut} className="font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Sign out
        </button>
      </p>
    </div>
  );
}
