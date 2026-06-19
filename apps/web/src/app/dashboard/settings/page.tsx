"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/DashboardShell";
import { PushNotificationManager } from "@/components/PushNotificationManager";
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
      // Sign out locally and leave the app.
      await supabase.auth.signOut();
      router.replace("/auth/login");
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold" style={{ color: "#ededed" }}>
          Settings
        </h1>

        <section
          className="mt-8 rounded-2xl p-6"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h2 className="text-base font-semibold" style={{ color: "#ededed" }}>
            Push Notifications
          </h2>
          <div className="mt-4">
            <PushNotificationManager />
          </div>
        </section>

        {/* Danger zone */}
        <section
          className="mt-8 rounded-2xl p-6"
          style={{
            background: "rgba(239,68,68,0.05)",
            border: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          <h2 className="text-base font-semibold" style={{ color: "#f87171" }}>
            Delete account
          </h2>
          <p className="mt-2 text-sm" style={{ color: "#a0a0a0" }}>
            This permanently deletes your account and all your data — profile,
            logs, plans, and chats. Your account is deactivated immediately and
            erased after 30 days. <strong>This cannot be undone.</strong>
          </p>

          <label
            htmlFor="confirm"
            className="mt-5 block text-xs font-medium"
            style={{ color: "#9a9a9a" }}
          >
            Type <span style={{ color: "#f87171" }}>DELETE</span> to confirm
          </label>
          <input
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            className="mt-1.5 w-full max-w-xs rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#f0f0f0",
            }}
          />

          {error && (
            <p className="mt-3 text-xs" style={{ color: "#f87171" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleDelete}
            disabled={!canDelete}
            className="mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: "#dc2626", color: "#fff" }}
          >
            {submitting ? "Deleting…" : "Delete my account"}
          </button>
        </section>
      </div>
    </DashboardShell>
  );
}
