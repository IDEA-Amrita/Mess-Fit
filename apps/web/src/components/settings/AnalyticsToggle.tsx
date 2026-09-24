"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { isOptedOut, setOptOut } from "@/lib/analytics";

/** Opt-out switch for first-party usage analytics (see lib/analytics.ts). */
export function AnalyticsToggle() {
  const id = useId();
  // Read after mount: localStorage doesn't exist during server rendering.
  const [share, setShare] = useState(true);
  const [browserSignal, setBrowserSignal] = useState(false);

  useEffect(() => {
    setShare(!isOptedOut());
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    setBrowserSignal(nav.doNotTrack === "1" || nav.globalPrivacyControl === true);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={id} className="text-sm font-semibold text-foreground">
            Share usage data
          </label>
          <p className="text-sm text-muted-foreground">
            Which features you use, and when — never what you eat, weigh or type. It stays in MessFit&apos;s own
            database and helps us fix what students actually struggle with.{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Privacy policy
            </Link>
          </p>
        </div>
        <Switch
          id={id}
          checked={share && !browserSignal}
          disabled={browserSignal}
          onCheckedChange={(on) => {
            setShare(on);
            setOptOut(!on);
          }}
        />
      </div>
      {browserSignal && (
        <p className="text-xs text-muted-foreground">
          Your browser is sending Do Not Track / Global Privacy Control, so nothing is collected regardless of this
          switch.
        </p>
      )}
    </div>
  );
}
