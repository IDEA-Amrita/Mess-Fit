"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <div
      className="relative flex min-h-screen items-center justify-center px-4"
      style={{ background: "#080808" }}
    >
      {/* Glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-0 -translate-x-1/2"
        style={{
          width: "600px",
          height: "400px",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold">
            <span style={{ color: "#f0f0f0" }}>Mess</span>
            <span style={{ color: "#f59e0b" }}>Fit</span>
          </Link>
          <p className="mt-2 text-sm" style={{ color: "#666" }}>
            Welcome back
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            backdropFilter: "blur(24px)",
          }}
        >
          <OAuthButtons />

          {/* Divider */}
          <div className="relative my-5 flex items-center">
            <div
              className="flex-1 border-t"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            />
            <span className="mx-3 text-xs" style={{ color: "#444" }}>
              or continue with email
            </span>
            <div
              className="flex-1 border-t"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium text-muted-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="rounded-xl border border-border bg-white/5 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-medium text-muted-foreground"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="rounded-xl border border-border bg-white/5 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring"
              />
            </div>

            {error && (
              <p
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  color: "#f87171",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 rounded-xl py-2.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #d97706, #f59e0b)",
                color: "#000",
              }}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm" style={{ color: "#555" }}>
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="font-medium"
            style={{ color: "#f59e0b" }}
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
