// Push event handler — shows notification when Worker sends a push
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icon.png",
      badge: data.icon || "/icon.png",
      tag: data.prayer,
      requireInteraction: false,
    })
  );
});

// Notification click handler — opens the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
