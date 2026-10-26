self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  if (event.data) {
    let data;
    try { data = event.data.json(); } catch { return; }
    const options = {
      body: data.body,
      icon: "/apple-touch-icon.png",
      badge: "/app-icon.svg",
      tag: data.tag || "partner-ping",
      vibrate: [100, 50, 100],
      data: {
        url: data.url || "/?tab=chat",
      },
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (
          new URL(client.url).origin === self.location.origin &&
          "focus" in client
        ) {
          client.postMessage({ type: "OPEN_CHAT" });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || "/?tab=chat");
      }
    }),
  );
});
