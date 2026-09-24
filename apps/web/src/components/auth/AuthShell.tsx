"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

/** Shared frame for every sign-in-flow screen: logo, subtitle, card, footer line. */
export function AuthShell({
  subtitle,
  children,
  footer,
}: {
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex min-h-11 items-center text-3xl font-black tracking-tighter">
            <span className="text-white">MESS</span>
            <span className="text-accent">FIT</span>
          </Link>
          <p className="mt-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">{subtitle}</p>
        </div>
        <div className="surface-card">{children}</div>
        {footer && <p className="mt-6 text-center text-[13px] font-bold text-muted-foreground">{footer}</p>}
      </motion.div>
    </div>
  );
}

export const AUTH_INPUT =
  "w-full rounded-xl border-2 border-border bg-surface-2 px-4 py-3 text-sm font-medium text-white outline-none transition-colors focus:border-accent focus:ring-0";
export const AUTH_LABEL = "text-[11px] font-black uppercase tracking-widest text-muted-foreground";
export const AUTH_SUBMIT =
  "mt-4 rounded-xl bg-accent py-3.5 text-[13px] font-black uppercase tracking-widest text-black transition-colors hover:bg-white disabled:opacity-50";

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-[#FF3B30]/30 bg-[#FF3B30]/10 px-4 py-3 text-[13px] font-bold text-[#FF3B30]">
      {children}
    </p>
  );
}
