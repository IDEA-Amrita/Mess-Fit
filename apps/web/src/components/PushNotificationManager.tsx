"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type Status = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed" | "error";

export function PushNotificationManager() {
  const [status, setStatus] = useState<Status>("loading");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  // `error` drives the colour; deriving it from the wording ("fail", "denied") was fragile.
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // On mount: check support, register SW, check existing subscription
  useEffect(() => {
    async function init() {
      // Check browser support
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }

      // Check if permission was previously denied
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }

      try {
        // Explicitly register the service worker (don't rely on auto-registration)
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Wait for the SW to be active
        await navigator.serviceWorker.ready;

        // Check for existing subscription
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          setSubscription(existingSub);
          setStatus("subscribed");
        } else {
          setStatus("unsubscribed");
        }
      } catch (err) {
        console.error("Service Worker registration failed:", err);
        setStatus("error");
        setMessage({ text: "Could not initialize push notifications.", error: true });
      }
    }

    init();
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      setMessage({ text: "Push notifications are not configured on the server.", error: true });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus("denied");
        setMessage({ text: "Notification permission was denied. You can re-enable it in your browser settings.", error: true });
        setBusy(false);
        return;
      }
      if (permission !== "granted") {
        setMessage({ text: "Notification permission was dismissed. Try again when you're ready.", error: false });
        setBusy(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      setSubscription(sub);
      setStatus("subscribed");

      // Send the subscription to the backend
      const subJson = sub.toJSON();
      await apiFetch("/api/v1/notifications/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      });

      setMessage({ text: "Push notifications enabled!", error: false });
    } catch (error) {
      console.error("Push subscription failed:", error);
      setMessage({ text: "Failed to enable: " + (error instanceof Error && error.message ? error.message : "Unknown error"), error: true });
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribeFromPush = useCallback(async () => {
    if (!subscription) return;

    setBusy(true);
    setMessage(null);

    try {
      const subJson = subscription.toJSON();
      await subscription.unsubscribe();
      setSubscription(null);
      setStatus("unsubscribed");

      // Tell backend to remove
      await apiFetch("/api/v1/notifications/unsubscribe", {
        method: "DELETE",
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      });

      setMessage({ text: "Push notifications disabled.", error: false });
    } catch (error) {
      console.error("Unsubscribe failed:", error);
      setMessage({ text: "Failed to disable: " + (error instanceof Error && error.message ? error.message : "Unknown error"), error: true });
    } finally {
      setBusy(false);
    }
  }, [subscription]);

  // --- Render ---

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3" role="status">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm text-muted-foreground">Checking notification support…</p>
      </div>
    );
  }

  if (status === "unsupported") {
    return <p className="text-sm text-muted-foreground">Push notifications are not supported in this browser.</p>;
  }

  if (status === "denied") {
    return (
      <p className="text-sm text-destructive">
        Notification permission is blocked. To re-enable, click the lock icon in your browser&apos;s address bar and
        allow notifications for this site.
      </p>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-destructive">
          {message?.text || "Something went wrong initializing push notifications."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-fit rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-white/15"
        >
          Retry
        </button>
      </div>
    );
  }

  const isSubscribed = status === "subscribed";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Receive alerts for meal reviews, weekly check-ins, and reminders.
        </p>
        <button
          onClick={isSubscribed ? unsubscribeFromPush : subscribeToPush}
          disabled={busy}
          className={
            "shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50 " +
            (isSubscribed ? "bg-white/10 text-foreground hover:bg-white/15" : "bg-accent text-accent-foreground hover:brightness-110")
          }
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {isSubscribed ? "Disabling…" : "Enabling…"}
            </span>
          ) : isSubscribed ? (
            "Disable"
          ) : (
            "Enable"
          )}
        </button>
      </div>
      {message && (
        <p role={message.error ? "alert" : "status"} className={"text-xs " + (message.error ? "text-destructive" : "text-accent")}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

