// MessFit development service worker.
// `next dev` (Turbopack) doesn't run next-pwa, so development registers this
// hand-written worker instead. Production registers /sw.js, which next-pwa
// generates at build time from worker/index.ts and is not committed.
// Keep the push behaviour here in sync with worker/index.ts.

self.addEventListener("install", () => {
  // Activate immediately, don't wait for old SW to finish
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
});

// --- Push Notifications ---

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "MessFit";
  const options = {
    body: data.body || "You have a new notification.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "messfit-notification",
    renotify: !!data.tag,
    data: {
      url: data.url || "/dashboard",
    },
    actions: data.actions || [],
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/dashboard";

  // Focus an existing tab or open a new one
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a MessFit tab is already open, focus it and navigate
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Otherwise open a new tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// Handle notification close (for analytics, if needed later)
self.addEventListener("notificationclose", () => {
  // Could send analytics event here in the future
});
