self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    return;
  }
  if (!data.title) return;
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
      tag: data.notification && data.notification.id,
    })
  );
});

// Mirrors sameOriginTarget in src/features/notifications/push.ts (tested there); keep in sync.
function sameOriginTarget(raw, origin) {
  try {
    const u = new URL(raw, origin);
    return new URL(u.pathname + u.search + u.hash, origin).href;
  } catch {
    return new URL('/', origin).href;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const origin = self.location.origin;
  const raw = event.notification.data && event.notification.data.url;
  const target = sameOriginTarget(raw, origin);
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const match = clients.find((c) => new URL(c.url).origin === origin);
        if (!match) return self.clients.openWindow(target);
        // navigate() rejects for clients the worker does not control.
        return match
          .focus()
          .then((c) => (c || match).navigate(target))
          .then((c) => c || self.clients.openWindow(target))
          .catch(() => self.clients.openWindow(target));
      })
  );
});
