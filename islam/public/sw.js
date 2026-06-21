// Push event handler — shows notification when Worker sends a push
// data shape: { title, body, icon, tag, data: { prayer } }
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icon.png",
      badge: data.icon || "/icon.png",
      tag: data.tag, // e.g. "prayer-fajr" — used to coalesce repeated notifications
      requireInteraction: false,
    })
  );
});

// Notification click handler — opens the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
