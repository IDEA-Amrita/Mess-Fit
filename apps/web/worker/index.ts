/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "MessFit";
  const options = {
    body: data.body || "You have a new message.",
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    data: data.url || "/",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data;
  if (url) {
    event.waitUntil(self.clients.openWindow(url));
  }
});
