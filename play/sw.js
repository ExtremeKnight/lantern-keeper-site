// Lantern Keeper's service worker (made by tools/build-web.js): the game's own files, for starting offline.
const CACHE = 'lk-0.31.1-69431bd9ca', FILES = ["./","index.html","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","game.6f82848f6e.js","i18n/es.json","i18n/fil.json","i18n/id.json","i18n/ja.json","i18n/ko.json","i18n/pt-BR.json","i18n/zh-CN.json"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('lk-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return; // accounts, online play, the human check: always the network
  // the page: the network first (a new version arrives at once), the cached copy when offline
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put('index.html', c)); return r; }).catch(() => caches.match('index.html'))); return; }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
// 0.31: notifications for players of the web version (supabase/functions/push sends them by web push)
self.addEventListener('push', e => { let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Lantern Keeper', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Lantern Keeper', { body: d.body || '', tag: d.tag || 'lk', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { kind: d.kind || '' } })); });
self.addEventListener('notificationclick', e => { e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { const w = ws.find(x => x.url.startsWith(self.registration.scope)); if (w) { w.postMessage({ lk: 'notice' }); return w.focus(); } return self.clients.openWindow('./#notices'); })); });
