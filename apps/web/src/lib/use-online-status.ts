"use client";

import { useEffect, useState } from "react";

/**
 * `navigator.onLine` plus the `online`/`offline` events, kept SSR/hydration-safe:
 * the server always renders "online" (there's no navigator), and the real value
 * is read only after mount so React doesn't complain about a client/server
 * mismatch on a page loaded while actually offline.
 *
 * `navigator.onLine` only reflects link-layer connectivity (Wi-Fi/ethernet
 * present), not a working path to the internet, so a flaky connection can
 * still report "online" — this is a reasonable best-effort signal, not a
 * guarantee.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
