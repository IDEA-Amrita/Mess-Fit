import { apiFetch } from "./api";
import { supabase } from "./supabase";

/** Cleanup must never trap someone on a signed-in screen (offline, slow API). */
const DETACH_TIMEOUT_MS = 3000;

/**
 * Stop this browser receiving the signed-out account's notifications.
 *
 * A push subscription belongs to the browser, not the session, so on a shared
 * hostel computer it would otherwise keep delivering the previous student's
 * reminders to whoever uses the machine next. The server row is removed while
 * the token is still valid (best effort), and the browser subscription is
 * dropped regardless — a server row left behind is pruned on its first 404/410.
 */
async function detachPushSubscription(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const sub = await registration?.pushManager.getSubscription();
  if (!sub) return;
  try {
    const { endpoint, keys } = sub.toJSON();
    await apiFetch("/api/v1/notifications/unsubscribe", {
      method: "DELETE",
      body: JSON.stringify({ endpoint, keys }),
    });
  } catch {
    // Signed out already, deleted account, or offline: fall through.
  } finally {
    await sub.unsubscribe().catch(() => {});
  }
}

/** Sign out of Supabase after detaching this device from push notifications. */
export async function signOut(): Promise<void> {
  try {
    await Promise.race([
      detachPushSubscription(),
      new Promise<void>((resolve) => setTimeout(resolve, DETACH_TIMEOUT_MS)),
    ]);
  } catch {
    // Never block signing out.
  }
  await supabase.auth.signOut();
}
