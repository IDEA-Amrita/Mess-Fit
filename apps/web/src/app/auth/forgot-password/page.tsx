"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { AUTH_INPUT, AUTH_LABEL, AUTH_SUBMIT, AuthError, AuthShell } from "@/components/auth/AuthShell";
import { friendlyAuthError } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setSubmitting(false);
    if (err) {
      setError(friendlyAuthError(err));
      return;
    }
    // Same message whether or not the address has an account — Supabase doesn't
    // say, and neither should we.
    setSentTo(email.trim());
  }

  return (
    <AuthShell
      subtitle="Reset your password"
      footer={
        <Link href="/auth/login" className="text-accent transition-colors hover:text-white">
          Back to sign in
        </Link>
      }
    >
      {sentTo ? (
        <div role="status" className="space-y-3 text-center">
          <p className="text-sm font-medium text-foreground">
            If an account exists for <span className="font-bold text-accent">{sentTo}</span>, a reset link is on its way.
          </p>
          <p className="text-[13px] text-muted-foreground">
            It can take a minute. Check spam if it doesn&apos;t show up, and open the link on this device.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-[13px] text-muted-foreground">
            Enter your email and we&apos;ll send you a link to choose a new password.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className={AUTH_LABEL}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={AUTH_INPUT}
            />
          </div>
          {error && <AuthError>{error}</AuthError>}
          <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={submitting} className={AUTH_SUBMIT}>
            {submitting ? "Sending…" : "Send reset link"}
          </motion.button>
        </form>
      )}
    </AuthShell>
  );
}
