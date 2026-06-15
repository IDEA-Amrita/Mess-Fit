"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <div
      className="relative flex min-h-screen items-center justify-center px-4 py-10"
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
            Create your account
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
                htmlFor="displayName"
                className="text-xs font-medium"
                style={{ color: "#9a9a9a" }}
              >
                Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="Your name"
                className="rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#f0f0f0",
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium"
                style={{ color: "#9a9a9a" }}
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
                className="rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#f0f0f0",
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-medium"
                style={{ color: "#9a9a9a" }}
              >
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
                className="rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#f0f0f0",
                }}
              />
            </div>

            <label
              className="flex items-start gap-2 text-xs"
              style={{ color: "#888" }}
            >
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 accent-amber-500"
                style={{ accentColor: "#f59e0b" }}
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" target="_blank" style={{ color: "#f59e0b" }}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" style={{ color: "#f59e0b" }}>
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

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
              disabled={submitting || !accepted}
              className="mt-1 rounded-xl py-2.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #d97706, #f59e0b)",
                color: "#000",
              }}
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm" style={{ color: "#555" }}>
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium"
            style={{ color: "#f59e0b" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
