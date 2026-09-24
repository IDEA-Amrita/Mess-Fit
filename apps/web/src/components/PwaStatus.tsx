"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Download01Icon, WifiDisconnected01Icon } from "@hugeicons/core-free-icons";
import { spring } from "@/lib/motion";
import { useInstallPrompt } from "@/lib/use-install-prompt";
import { useOnlineStatus } from "@/lib/use-online-status";

/**
 * App-wide PWA affordances, mounted once in Providers: an offline banner and
 * an install prompt. Kept as one component so they never both fight for the
 * same corner of the screen — offline takes priority and the install prompt
 * hides while it's showing.
 */
export function PwaStatus() {
  const pathname = usePathname();
  const online = useOnlineStatus();
  const { canInstall, promptInstall, dismiss } = useInstallPrompt();

  // A brief "Back online" confirmation reads better than the banner just
  // vanishing — but only after having actually been offline, not on the
  // very first render. `wasOffline` is a ref, not state: putting it in state
  // and depending on it would re-run this effect the instant it flips false,
  // and React runs the *previous* run's cleanup first — cancelling the very
  // timeout this effect had just started.
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOffline = useRef(false);
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 2500);
      return () => clearTimeout(t);
    }
  }, [online]);

  // Interrupting sign-in/sign-up with an install pitch is bad form.
  const onAuthFlow = pathname?.startsWith("/auth") || pathname?.startsWith("/onboarding");

  return (
    <>
      <AnimatePresence>
        {!online ? (
          <motion.div
            key="offline"
            role="status"
            initial={{ y: -48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -48, opacity: 0 }}
            transition={spring.snappy}
            className="fixed inset-x-0 top-0 z-70 flex items-center justify-center gap-2 bg-[#FF3B30] px-4 py-2 text-[13px] font-bold text-white"
          >
            <HugeiconsIcon icon={WifiDisconnected01Icon} className="h-4 w-4" />
            You&apos;re offline — showing the last data MessFit saved.
          </motion.div>
        ) : (
          showReconnected && (
            <motion.div
              key="online"
              role="status"
              initial={{ y: -48, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -48, opacity: 0 }}
              transition={spring.snappy}
              className="fixed inset-x-0 top-0 z-70 flex items-center justify-center gap-2 bg-accent px-4 py-2 text-[13px] font-bold text-accent-foreground"
            >
              Back online.
            </motion.div>
          )
        )}
      </AnimatePresence>

      <AnimatePresence>
        {online && canInstall && !onAuthFlow && (
          <motion.div
            key="install"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={spring.soft}
            className="fixed inset-x-4 bottom-20 z-60 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-border bg-popover p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
              <HugeiconsIcon icon={Download01Icon} className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-foreground">Install MessFit</p>
              <p className="text-[12px] text-muted-foreground">Faster launch, works offline.</p>
            </div>
            <button
              onClick={promptInstall}
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-[12px] font-bold text-accent-foreground transition-[filter] hover:brightness-110"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              aria-label="Dismiss install prompt"
              className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
