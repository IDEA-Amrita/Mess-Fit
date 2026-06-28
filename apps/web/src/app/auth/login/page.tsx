"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setSubmitting(false);

    if (err) {
      setError(err.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="text-3xl font-black tracking-tighter">
            <span className="text-white">MESS</span>
            <span className="text-accent">FIT</span>
          </Link>
          <p className="mt-2 text-sm font-bold text-muted-foreground uppercase tracking-widest">
            Welcome back
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
                placeholder="••••••••"
                className="rounded-xl border-2 border-border bg-surface-2 px-4 py-3 text-sm font-medium text-white outline-none transition-colors focus:border-accent focus:ring-0"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-[#FF3B30]/30 bg-[#FF3B30]/10 px-4 py-3 text-[13px] font-bold text-[#FF3B30]">
                {error}
              </p>
            )}

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="mt-4 rounded-xl bg-accent py-3.5 text-[13px] font-black uppercase tracking-widest text-black transition-colors hover:bg-white disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </motion.button>
          </form>
        </div>

        <p className="mt-6 text-center text-[13px] font-bold text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-accent hover:text-white transition-colors">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
