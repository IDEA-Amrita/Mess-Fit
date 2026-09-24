"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

import { AUTH_SUBMIT, AuthError, AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { friendlyAuthError } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast-store";

type Phase = "checking" | "ready" | "expired";

/**
 * Landing page for the emailed recovery link. Supabase exchanges the link's
 * code for a (recovery) session in the browser; once that exists the user can
 * set a new password. No session after a grace period means the link was
 * expired, already used, or opened on a different device than it was requested
 * from (PKCE ties it to the requesting browser).
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setPhase("ready");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setPhase("ready");
    });
    const timeout = setTimeout(() => setPhase((p) => (p === "checking" ? "expired" : p)), 6000);
    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setSubmitting(false);
      setError(friendlyAuthError(err));
      return;
    }
    toast.success("Password updated.");
    router.replace("/dashboard");
  }

  if (phase === "checking") {
    return (
      <AuthShell subtitle="Reset your password">
        <div role="status" className="flex flex-col items-center gap-3 py-4">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
          <p className="text-sm text-muted-foreground">Verifying your link…</p>
        </div>
      </AuthShell>
    );
  }

  if (phase === "expired") {
    return (
      <AuthShell subtitle="Link expired">
        <div role="alert" className="space-y-4 text-center">
          <p className="text-sm font-medium text-foreground">This reset link is invalid or has expired.</p>
          <p className="text-[13px] text-muted-foreground">
            Links work once, and only in the browser you requested them from. Request a fresh one.
          </p>
          <Link href="/auth/forgot-password" className={`${AUTH_SUBMIT} block`}>
            Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="Choose a new password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <PasswordField
          id="password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          placeholder="Min. 8 characters"
        />
        <PasswordField
          id="confirm"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          minLength={8}
        />
        {error && <AuthError>{error}</AuthError>}
        <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={submitting} className={AUTH_SUBMIT}>
          {submitting ? "Saving…" : "Update password"}
        </motion.button>
      </form>
    </AuthShell>
  );
}
