"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

import { AUTH_INPUT, AUTH_LABEL, AUTH_SUBMIT, AuthError, AuthShell } from "@/components/auth/AuthShell";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { PasswordField } from "@/components/auth/PasswordField";
import { friendlyAuthError } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accepted) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });

    if (err) {
      setSubmitting(false);
      setError(friendlyAuthError(err));
      return;
    }

    // With email confirmation on, Supabase returns no session (and, to avoid
    // revealing which emails exist, an empty `identities` list for an address
    // that is already registered). Pushing to /onboarding here would just bounce
    // a signed-out user to the login page with no explanation.
    if (!data.session) {
      setSubmitting(false);
      if (data.user && data.user.identities?.length === 0) {
        setError("An account with this email already exists. Try signing in instead.");
        return;
      }
      setConfirmEmail(email.trim());
      return;
    }

    router.push("/onboarding/profile");
  }

  if (confirmEmail) {
    return (
      <AuthShell
        subtitle="Check your email"
        footer={
          <>
            Wrong address?{" "}
            <button onClick={() => setConfirmEmail(null)} className="text-accent transition-colors hover:text-white">
              Go back
            </button>
          </>
        }
      >
        <div role="status" className="space-y-3 text-center">
          <p className="text-sm font-medium text-foreground">
            We sent a confirmation link to <span className="font-bold text-accent">{confirmEmail}</span>.
          </p>
          <p className="text-[13px] text-muted-foreground">
            Open it on this device to finish creating your account. Nothing in your inbox? Check spam, then try again.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      subtitle="Create an account"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/auth/login" className="text-accent transition-colors hover:text-white">
            Sign in
          </Link>
        </>
      }
    >
      <OAuthButtons onError={setError} />

      <div className="relative my-6 flex items-center">
        <div className="flex-1 border-t border-border" />
        <span className="mx-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">or email</span>
        <div className="flex-1 border-t border-border" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="displayName" className={AUTH_LABEL}>
            Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Athlete name"
            className={AUTH_INPUT}
          />
        </div>

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

        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          placeholder="Min. 8 characters"
        />

        <label className="mt-2 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-surface-2 text-accent focus:ring-accent focus:ring-offset-background"
            style={{ accentColor: "var(--accent)" }}
          />
          <span className="text-[12px] font-medium leading-relaxed text-muted-foreground">
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="font-bold text-accent transition-colors hover:text-white">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="font-bold text-accent transition-colors hover:text-white">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {error && <AuthError>{error}</AuthError>}

        <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={submitting || !accepted} className={AUTH_SUBMIT}>
          {submitting ? "Creating account…" : "Create account"}
        </motion.button>
      </form>
    </AuthShell>
  );
}
