"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast-store";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Skeleton } from "@/components/ui/skeleton";

const NAME_MAX = 40;

/** Avatar, display name, email and sign-out. */
export function AccountCard() {
  const router = useRouter();
  const nameId = useId();
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [savedName, setSavedName] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (user) {
        const current = (user.user_metadata?.display_name as string | undefined) ?? "";
        setEmail(user.email ?? null);
        setSavedName(current);
        setName(current);
      }
      setLoaded(true);
    });
  }, []);

  const trimmed = name.trim();
  const canSave = loaded && !saving && trimmed.length > 0 && trimmed !== savedName;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    // The shell listens for USER_UPDATED, so the sidebar name changes immediately.
    const { error } = await supabase.auth.updateUser({ data: { display_name: trimmed } });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Couldn't update your name");
      return;
    }
    setSavedName(trimmed);
    setName(trimmed);
    toast.success("Name updated");
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  return (
    <div className="space-y-6">
      <AvatarUpload />

      <form onSubmit={saveName} className="flex flex-col gap-2">
        <label htmlFor={nameId} className="text-xs font-medium text-muted-foreground">
          Display name
        </label>
        {loaded ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              autoComplete="nickname"
              placeholder="How should we address you?"
              className="min-w-0 flex-1 rounded-xl border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring"
            />
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-white/15 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <Skeleton className="h-[42px]" />
        )}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <div className="min-w-0">
          <p className="label-caps">Email</p>
          <p className="mt-1 truncate text-sm font-medium text-foreground">{email ?? "—"}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="rounded-full border border-border px-5 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
