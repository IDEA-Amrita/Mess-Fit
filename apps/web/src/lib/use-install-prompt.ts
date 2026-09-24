"use client";

import { useEffect, useState } from "react";

/** Not in lib.dom.d.ts yet — this is the standard shape Chromium ships. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "messfit:install-dismissed-at";
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks

function isStandalone(): boolean {
  // iOS Safari doesn't fire beforeinstallprompt or support display-mode match
  // media reliably pre-launch, but does expose `navigator.standalone` once
  // actually installed.
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function dismissedRecently(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && Date.now() - at < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Captures the browser's install prompt (which fires once, early, and is
 * gone forever if not saved) so we can trigger it later from our own button
 * instead of the browser's mini-infobar. Chromium-only — Safari/Firefox never
 * fire the event, so `canInstall` simply stays false there, which is correct:
 * those browsers have their own "Add to Home Screen" affordance already.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const canInstall = !!deferred && !installed && !isStandalone() && !dismissedRecently();

  async function promptInstall(): Promise<boolean> {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // Spent either way — Chromium only lets a captured prompt fire once.
    setDeferred(null);
    return outcome === "accepted";
  }

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage unavailable — it'll just ask again next visit */
    }
    setDeferred(null);
  }

  return { canInstall, promptInstall, dismiss };
}
