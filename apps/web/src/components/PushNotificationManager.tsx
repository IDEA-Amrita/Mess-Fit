"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type Status = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed" | "error";

export function PushNotificationManager() {
  const [status, setStatus] = useState<Status>("loading");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [message, setMessage] = useState("");
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
        setMessage("Could not initialize push notifications.");
      }
    }

    init();
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      setMessage("Push notifications are not configured on the server.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus("denied");
        setMessage("Notification permission was denied. You can re-enable it in your browser settings.");
        setBusy(false);
        return;
      }
      if (permission !== "granted") {
        setMessage("Notification permission was dismissed. Try again when you're ready.");
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

      setMessage("Push notifications enabled!");
    } catch (error: any) {
      console.error("Push subscription failed:", error);
      setMessage("Failed to enable: " + (error.message || "Unknown error"));
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribeFromPush = useCallback(async () => {
    if (!subscription) return;

    setBusy(true);
    setMessage("");

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

      setMessage("Push notifications disabled.");
    } catch (error: any) {
      console.error("Unsubscribe failed:", error);
      setMessage("Failed to disable: " + (error.message || "Unknown error"));
    } finally {
      setBusy(false);
    }
  }, [subscription]);

  // --- Render ---

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm" style={{ color: "#a0a0a0" }}>
          Checking notification support…
        </p>
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <p className="text-sm" style={{ color: "#a0a0a0" }}>
        Push notifications are not supported in this browser.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm" style={{ color: "#f87171" }}>
          Notification permission is blocked. To re-enable, click the lock icon in
          your browser&apos;s address bar and allow notifications for this site.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm" style={{ color: "#f87171" }}>
          {message || "Something went wrong initializing push notifications."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-fit rounded-xl px-4 py-2 text-sm font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}
        >
          Retry
        </button>
      </div>
    );
  }

  const isSubscribed = status === "subscribed";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "#a0a0a0" }}>
          Receive alerts for meal reviews, weekly check-ins, and reminders.
        </p>
        <button
          onClick={isSubscribed ? unsubscribeFromPush : subscribeToPush}
          disabled={busy}
          className="rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50"
          style={{
            background: isSubscribed ? "rgba(255,255,255,0.1)" : "#ccff00",
            color: isSubscribed ? "#fff" : "#000",
          }}
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
        <p
          className="text-xs"
          style={{ color: message.toLowerCase().includes("fail") || message.toLowerCase().includes("denied") ? "#f87171" : "#ccff00" }}
        >
          {message}
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

