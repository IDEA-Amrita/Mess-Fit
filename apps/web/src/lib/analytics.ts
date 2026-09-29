/**
 * First-party product analytics: a tiny batching client for
 * POST /api/v1/analytics/events (services/api/messfit_api/analytics).
 *
 * Principles (mirrored by the server's validation, which is the real gate):
 *  - Only allow-listed event names, and a few short slug-valued props. Never
 *    free text, and never the content of anything the user logged.
 *  - Signed-in users only. Every event is tagged with the user id at the time
 *    it was tracked and dropped if the session belongs to someone else by the
 *    time it is sent (shared hostel computers), or on sign-out.
 *  - Respects the user's choice: an opt-out switch in Settings, plus the
 *    browser's Do Not Track / Global Privacy Control signals.
 *  - Never affects the app: no thrown errors, no Sentry noise, no retries.
 */

import { supabase } from "./supabase";

export type EventName =
  | "session_start"
  | "onboarding_completed"
  | "plate_viewed"
  | "meal_logged"
  | "weight_logged"
  | "workout_saved"
  | "chat_message_sent"
  | "notifications_enabled"
  | "pwa_installed"
  | "article_opened";

type Props = Record<string, string | number | boolean>;
// `uid` is null for events tracked before the session has been resolved (child
// effects run before Providers' own); they are claimed or dropped once it is.
type QueuedEvent = { uid: string | null; name: EventName; props: Props; occurred_at: string };

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
export const OPT_OUT_KEY = "messfit:analytics-optout";
const FLUSH_MS = 5000;
const MAX_QUEUE = 50;
const MAX_BATCH = 20;
const SESSION_FLAG = "messfit:analytics-session";

let queue: QueuedEvent[] = [];
let uid: string | null = null;
let ready = false; // the auth session has been resolved at least once
let timer: ReturnType<typeof setTimeout> | null = null;

function storage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // private mode / blocked storage
  }
}

/** The browser is sending Do Not Track or Global Privacy Control. */
export function hasBrowserPrivacySignal(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

/** True unless the user (or their browser) has said no. */
export function analyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return !isOptedOut() && !hasBrowserPrivacySignal();
}

const optOutListeners = new Set<() => void>();

/** For useSyncExternalStore: fires when the opt-out changes here or in another tab. */
export function subscribeOptOut(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === OPT_OUT_KEY) onChange();
  };
  optOutListeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    optOutListeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether the opt-out was chosen in-app (as opposed to a browser signal). */
export function isOptedOut(): boolean {
  return storage("local")?.getItem(OPT_OUT_KEY) === "1";
}

export function setOptOut(optedOut: boolean): void {
  const s = storage("local");
  if (optedOut) {
    s?.setItem(OPT_OUT_KEY, "1");
    queue = []; // anything not yet sent is discarded, not sent late
  } else {
    s?.removeItem(OPT_OUT_KEY);
  }
  optOutListeners.forEach((notify) => notify());
}

/** Mirror of the server's slug rule: lowercase, [a-z0-9_.:-], 1-64 chars. */
function slug(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9_.:-]+/g, "_").replace(/^[^a-z0-9]+/, "").slice(0, 64);
}

function cleanProps(props: Props): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props).slice(0, 8)) {
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(k)) continue;
    if (typeof v === "string") {
      const s = slug(v);
      if (s) out[k] = s;
    } else if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) {
      out[k] = v;
    }
  }
  return out;
}

export function track(name: EventName, props: Props = {}): void {
  if ((ready && !uid) || !analyticsEnabled()) return;
  queue.push({ uid, name, props: cleanProps(props), occurred_at: new Date().toISOString() });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS);
}

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!ready) {
    timer = setTimeout(() => void flush(), FLUSH_MS);
    return;
  }
  if (!queue.length) return;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);
  if (queue.length) timer = setTimeout(() => void flush(), FLUSH_MS);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    // Someone else may have signed in since these were tracked.
    const mine = batch.filter((e) => e.uid === session.user.id);
    if (!mine.length) return;
    await fetch(`${BASE}/api/v1/analytics/events`, {
      method: "POST",
      keepalive: true, // lets the request outlive a closing tab
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ events: mine.map(({ name, props, occurred_at }) => ({ name, props, occurred_at })) }),
    });
  } catch {
    // Analytics is best-effort by design.
  }
}

/** Wire up identity, flushing and the once-per-browser-session `session_start`. Returns a cleanup. */
export function initAnalytics(): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      queue = [];
      uid = null;
      ready = true;
      storage("session")?.removeItem(SESSION_FLAG);
      return;
    }
    const next = session?.user.id ?? null;
    // Claim events tracked before we knew who this was; drop anyone else's.
    queue = queue.flatMap((e) => (e.uid === null ? (next ? [{ ...e, uid: next }] : []) : e.uid === next ? [e] : []));
    uid = next;
    ready = true;
    if (uid && !storage("session")?.getItem(SESSION_FLAG)) {
      storage("session")?.setItem(SESSION_FLAG, "1");
      track("session_start");
    }
  });

  const onHide = () => {
    if (document.visibilityState === "hidden") void flush();
  };
  const onPageHide = () => void flush();
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onPageHide);

  return () => {
    subscription.unsubscribe();
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onPageHide);
  };
}
