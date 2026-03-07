self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const title =
        typeof data.title === "string" ? data.title : "The Magic Lab";
      const body = typeof data.body === "string" ? data.body : "";
      const options = {
        body,
        icon:
          typeof data.icon === "string" && data.icon.startsWith("/")
            ? data.icon
            : "/icon-192x192.png",
        badge: "/icon-192x192.png",
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: "1",
        },
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch {
      event.waitUntil(
        self.registration.showNotification("The Magic Lab", {
          body: "You have a new notification.",
          icon: "/icon-192x192.png",
          badge: "/icon-192x192.png",
        })
      );
    }
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(self.location.origin));
});
