"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { DashboardShell } from "@/components/DashboardShell";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { AccountCard } from "@/components/settings/AccountCard";
import { PlanEditor } from "@/components/settings/PlanEditor";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { PageHeader } from "@/components/ui/page-header";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { spring } from "@/lib/motion";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

function Section({
  id,
  title,
  description,
  children,
  tone = "default",
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  const headingId = useId();
  return (
    <StaggerItem>
      <section
        id={id}
        aria-labelledby={headingId}
        className={cn(
          "scroll-mt-24 rounded-3xl border p-5 sm:p-6",
          tone === "danger" ? "border-destructive/20 bg-destructive/5" : "border-border bg-surface",
        )}
      >
        <h2
          id={headingId}
          className={cn("label-caps flex items-center gap-2", tone === "danger" && "text-destructive")}
        >
          {tone === "danger" && <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-destructive" />}
          {title}
        </h2>
        {description && <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
        <div className="mt-5">{children}</div>
      </section>
    </StaggerItem>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const confirmId = useId();
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
      // Providers clears every per-account cache on SIGNED_OUT.
      await supabase.auth.signOut();
      router.replace("/auth/login");
    } catch (e) {
      setError(apiErrorMessage(e));
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 p-5 sm:p-6 lg:p-8">
        <PageHeader title="Settings" description="Manage your plan, account and data" />

        <Stagger onMount gap={0.06} className="space-y-6">
          <Section id="plan" title="Your plan" description="Change your goal, diet or mess and your daily targets are recalculated.">
            <PlanEditor />
          </Section>

          <Section title="Account">
            <AccountCard />
          </Section>

          <Section title="Notifications">
            <PushNotificationManager />
          </Section>

          <Section title="Privacy & legal">
            <div className="flex flex-wrap gap-x-6 text-sm">
              <Link href="/privacy" className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4 hover:text-accent">
                Privacy policy
              </Link>
              <Link href="/terms" className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4 hover:text-accent">
                Terms of service
              </Link>
            </div>
          </Section>

          <Section
            tone="danger"
            title="Danger zone"
            description="This permanently deletes your account and all your data — profile, logs, plans, and chats. Your account is deactivated immediately and erased after 30 days. This cannot be undone."
          >
            <div className="rounded-2xl border border-border bg-black/30 p-5">
              <label htmlFor={confirmId} className="mb-2 block text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                Type <span className="text-destructive">DELETE</span> to confirm
              </label>
              <input
                id={confirmId}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                className="block w-full max-w-xs rounded-xl border border-border bg-transparent px-4 py-3 text-[14px] font-medium text-foreground outline-none transition-colors placeholder:text-zinc-700 focus:border-destructive/50 focus:bg-white/5"
              />

              {error && (
                <p role="alert" className="mt-3 text-[13px] font-medium text-destructive">
                  {error}
                </p>
              )}

              <motion.button
                onClick={handleDelete}
                disabled={!canDelete}
                whileTap={canDelete ? { scale: 0.97 } : undefined}
                transition={spring.snappy}
                className={cn(
                  "mt-5 block w-full max-w-xs rounded-full bg-[#dc2626] py-3 text-[14px] font-bold text-white transition-[opacity,box-shadow] disabled:opacity-30",
                  canDelete && "shadow-[0_0_20px_rgba(220,38,38,0.3)]",
                )}
              >
                {submitting ? "Deleting…" : "Permanently Delete Account"}
              </motion.button>
            </div>
          </Section>
        </Stagger>
      </div>
    </DashboardShell>
  );
}
