self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Thông báo mới', body: event.data?.text() || '' };
  }

  const title = payload.title || 'Thông báo mới';
  const options = {
    body: payload.body || 'Bạn có đơn mới cần xử lý.',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: payload.tag,
    silent: false,
    data: { url: payload.url || '/approvals/leave' },
    vibrate: [120, 60, 120],
  };

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'APPROVAL_PUSH_RECEIVED', payload }));
    }),
  ]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/approvals/leave', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  }));
});
