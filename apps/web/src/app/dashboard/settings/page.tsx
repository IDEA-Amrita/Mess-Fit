"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/DashboardShell";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { AvatarUpload } from "@/components/AvatarUpload";
import { apiFetch, ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirm.trim() === "DELETE" && !submitting;

  async function handleDelete() {
    if (!canDelete) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/v1/account/delete", {
        method: "POST",
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      await supabase.auth.signOut();
      router.replace("/auth/login");
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell>
      <div className="mf-rise mx-auto w-full max-w-4xl flex-1 space-y-8 p-5 sm:p-6 lg:p-8">
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.04em", color: "#f4f4f5" }}>
              Settings
            </h1>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "#a1a1aa", marginTop: "4px" }}>
              Manage your preferences and data
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <section className="glass-card p-6" style={{ borderRadius: "1.5rem" }}>
            <h2 className="label-caps mb-6" style={{ color: "#a1a1aa" }}>Profile</h2>
            <AvatarUpload />
          </section>

          <section className="glass-card p-6" style={{ borderRadius: "1.5rem" }}>
            <h2 className="label-caps mb-6" style={{ color: "#a1a1aa" }}>Notifications</h2>
            <PushNotificationManager />
          </section>

          {/* Danger zone */}
          <section className="glass-card p-6 group" style={{ borderRadius: "1.5rem", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)" }}>
            <h2 className="label-caps mb-2 flex items-center gap-2" style={{ color: "#f87171" }}>
              <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "#f87171" }} />
              Danger Zone
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "#a1a1aa" }}>
              This permanently deletes your account and all your data — profile,
              logs, plans, and chats. Your account is deactivated immediately and
              erased after 30 days. <strong className="text-white">This cannot be undone.</strong>
            </p>

            <div className="mt-8 rounded-xl p-5" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <label
                htmlFor="confirm"
                className="block text-[12px] font-bold uppercase tracking-wider mb-2"
                style={{ color: "#a1a1aa" }}
              >
                Type <span style={{ color: "#f87171" }}>DELETE</span> to confirm
              </label>
              <input
                id="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                className="w-full max-w-xs rounded-xl bg-transparent px-4 py-3 text-[14px] font-medium outline-none transition-all placeholder:text-zinc-700 focus:bg-white/5"
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#f4f4f5",
                }}
              />

              {error && (
                <p className="mt-3 text-[13px] font-medium" style={{ color: "#f87171" }}>
                  {error}
                </p>
              )}

              <button
                onClick={handleDelete}
                disabled={!canDelete}
                className="mt-5 w-full max-w-xs rounded-full py-3 text-[14px] font-bold transition-all disabled:opacity-30 disabled:hover:scale-100 hover:scale-[1.02] active:scale-95"
                style={{ background: "#dc2626", color: "#ffffff", boxShadow: canDelete ? "0 0 20px rgba(220,38,38,0.3)" : "none" }}
              >
                {submitting ? "Deleting…" : "Permanently Delete Account"}
              </button>
            </div>
          </section>
        </div>
      </div>

      <style jsx global>{`
        .glass-card {
          position: relative;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }
        .label-caps {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
      `}</style>
    </DashboardShell>
  );
}
