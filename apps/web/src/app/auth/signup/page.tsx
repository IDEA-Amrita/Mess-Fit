"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accepted) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });

    setSubmitting(false);

    if (err) {
      setError(err.message);
      return;
    }

    router.push("/onboarding/profile");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12 bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="text-3xl font-black tracking-tighter">
            <span className="text-white">MESS</span>
            <span className="text-accent">FIT</span>
          </Link>
          <p className="mt-2 text-sm font-bold text-muted-foreground uppercase tracking-widest">
            Create an account
          </p>
        </div>

        {/* Card */}
        <div className="surface-card">
          <OAuthButtons />

          {/* Divider */}
          <div className="relative my-6 flex items-center">
            <div className="flex-1 border-t border-border" />
            <span className="mx-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              or email
            </span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="displayName" className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="Athlete name"
                className="rounded-xl border-2 border-border bg-surface-2 px-4 py-3 text-sm font-medium text-white outline-none transition-colors focus:border-accent focus:ring-0"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="rounded-xl border-2 border-border bg-surface-2 px-4 py-3 text-sm font-medium text-white outline-none transition-colors focus:border-accent focus:ring-0"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min. 8 characters"
                className="rounded-xl border-2 border-border bg-surface-2 px-4 py-3 text-sm font-medium text-white outline-none transition-colors focus:border-accent focus:ring-0"
              />
            </div>

            <label className="mt-2 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-surface-2 text-accent focus:ring-accent focus:ring-offset-background"
                style={{ accentColor: "var(--accent)" }}
              />
              <span className="text-[12px] font-medium leading-relaxed text-muted-foreground">
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="font-bold text-accent hover:text-white transition-colors">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="font-bold text-accent hover:text-white transition-colors">
                  Privacy Policy
                </Link>.
              </span>
            </label>

            {error && (
              <p className="mt-2 rounded-xl border border-[#FF3B30]/30 bg-[#FF3B30]/10 px-4 py-3 text-[13px] font-bold text-[#FF3B30]">
                {error}
              </p>
            )}

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting || !accepted}
              className="mt-4 rounded-xl bg-accent py-3.5 text-[13px] font-black uppercase tracking-widest text-black transition-colors hover:bg-white disabled:opacity-50"
            >
              {submitting ? "Creating account…" : "Create account"}
            </motion.button>
          </form>
        </div>

        <p className="mt-6 text-center text-[13px] font-bold text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-accent hover:text-white transition-colors">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
