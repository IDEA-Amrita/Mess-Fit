"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      registerServiceWorker();
    }
  }, []);

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
    } catch (error) {
      console.error("Service Worker registration failed:", error);
    }
  }

  async function subscribeToPush() {
    try {
      if (!VAPID_PUBLIC_KEY) {
        setMessage("Push notifications are not configured on the server.");
        return;
      }
      
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      setSubscription(sub);

      // Send the subscription to the backend
      const subJson = sub.toJSON();
      await apiFetch("/api/v1/notifications/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      });

      setMessage("Subscribed successfully!");
    } catch (error: any) {
      console.error(error);
      setMessage("Failed to subscribe: " + error.message);
    }
  }

  async function unsubscribeFromPush() {
    try {
      if (!subscription) return;
      await subscription.unsubscribe();
      setSubscription(null);

      // Tell backend to remove
      const subJson = subscription.toJSON();
      await apiFetch("/api/v1/notifications/unsubscribe", {
        method: "DELETE",
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      });

      setMessage("Unsubscribed successfully.");
    } catch (error: any) {
      console.error(error);
      setMessage("Failed to unsubscribe: " + error.message);
    }
  }

  if (!isSupported) {
    return (
      <p className="text-sm" style={{ color: "#a0a0a0" }}>
        Push notifications are not supported in this browser.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "#a0a0a0" }}>
          Receive alerts for meal reviews, weekly check-ins, and reminders.
        </p>
        <button
          onClick={subscription ? unsubscribeFromPush : subscribeToPush}
          className="rounded-xl px-4 py-2 text-sm font-semibold transition-all"
          style={{
            background: subscription ? "rgba(255,255,255,0.1)" : "#f59e0b",
            color: subscription ? "#fff" : "#000",
          }}
        >
          {subscription ? "Disable" : "Enable"}
        </button>
      </div>
      {message && <p className="text-xs" style={{ color: "#f59e0b" }}>{message}</p>}
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
