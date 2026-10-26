self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  // Browsers (iOS especially) revoke the subscription if a push shows nothing,
  // so always display a notification, even when the payload is empty or malformed.
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  var options = {
    body: data.body || "יש הודעה חדשה",
    icon: "/apple-touch-icon.png",
    badge: "/app-icon.svg",
    tag: data.tag || "partner-ping",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/?tab=chat",
    },
  };
  event.waitUntil(self.registration.showNotification(data.title || "התראה חדשה", options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || "/?tab=chat";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          client.postMessage({ type: "OPEN_CHAT", url: target });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    }),
  );
});
