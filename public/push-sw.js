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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  if (!url) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const match = clients.find((c) => new URL(c.url).origin === new URL(url).origin);
      return match ? match.focus().then((c) => c.navigate(url)) : self.clients.openWindow(url);
    })
  );
});
