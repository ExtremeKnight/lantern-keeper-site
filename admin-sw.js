/* The dashboard as an app (0.30.1): its service worker, for the team's notifications only. It caches nothing (the
   dashboard always shows what the server says now); it shows a notification when the team-push function sends one,
   and a tap opens the dashboard at what it is about. Scope: /admin (the dashboard only, never the rest of the site). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* (online only: nothing kept) */ });
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Lantern Keeper dashboard', { body: d.body || '', tag: d.tag || 'lk', renotify: true, icon: 'assets/img/icon-192.png', badge: 'assets/img/icon-64.png', data: { url: d.url || 'admin.html' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || 'admin.html', self.location.origin + '/').href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const w of list) if (w.url.includes('/admin.html')) return w.focus().then(() => w.navigate(url)).catch(() => self.clients.openWindow(url));
    return self.clients.openWindow(url);
  }));
});
