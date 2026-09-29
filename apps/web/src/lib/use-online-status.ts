"use client";

import { useSyncExternalStore } from "react";

/**
 * `navigator.onLine` plus the `online`/`offline` events, kept SSR/hydration-safe:
 * the server always renders "online" (there's no navigator), and
 * useSyncExternalStore switches to the real value right after hydration, so
 * React never sees a client/server mismatch on a page loaded while offline.
 *
 * `navigator.onLine` only reflects link-layer connectivity (Wi-Fi/ethernet
 * present), not a working path to the internet, so a flaky connection can
 * still report "online" — this is a reasonable best-effort signal, not a
 * guarantee.
 */function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true, // server render + hydration: assume online
  );
}
