"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

import { AUTH_INPUT, AUTH_LABEL, AUTH_SUBMIT, AuthError, AuthShell } from "@/components/auth/AuthShell";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { PasswordField } from "@/components/auth/PasswordField";
import { friendlyAuthError } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // `?error=` is set by /auth/callback when an OAuth sign-in didn't complete.
  const [error, setError] = useState<string | null>(params.get("error"));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (err) {
      setSubmitting(false);
      setError(friendlyAuthError(err));
      return;
    }

    // Keep the button disabled through the redirect so a slow navigation
    // can't be double-submitted.
    router.push("/dashboard");
  }

  return (
    <AuthShell
      subtitle="Welcome back"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-accent transition-colors hover:text-white">
            Sign up
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
          autoComplete="current-password"
          placeholder="••••••••"
          labelAction={
            <Link href="/auth/forgot-password" className="-my-3 py-3 pl-3 text-[11px] font-bold text-accent transition-colors hover:text-white">
              Forgot password?
            </Link>
          }
        />

        {error && <AuthError>{error}</AuthError>}

        <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={submitting} className={AUTH_SUBMIT}>
          {submitting ? "Signing in…" : "Sign in"}
        </motion.button>
      </form>
    </AuthShell>
  );
}
