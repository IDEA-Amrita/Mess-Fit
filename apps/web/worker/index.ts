/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

// Production push handlers (next-pwa bundles this file into the generated
// service worker). Keep behaviour in sync with public/sw.js, which is what
// `next dev` serves.
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "MessFit";
  const options: NotificationOptions = {
    body: data.body || "You have a new notification.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "messfit-notification",
    data: { url: data.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url: string = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          void client.focus();
          return client.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
