// Service worker du dashboard /ventes : l'appli s'ouvre même sans réseau (dernière version et dernières données
// gardées), et les notifications de vente arrivent sur le téléphone.
// Les saisies faites hors réseau sont gardées par la page elle-même (src/ventes/lib/api.js), pas ici.

const CACHE = 'ventes-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

// réseau d'abord, la copie gardée si pas de réseau
async function networkFirst(req, key = req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw e;
  }
}

// fichiers de l'appli (noms uniques à chaque version) : la copie gardée d'abord
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') e.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === 'navigate' && url.pathname.startsWith('/ventes')) e.respondWith(networkFirst(req, '/ventes/'));
  else if (url.pathname === '/api/ventes' && !url.search) e.respondWith(networkFirst(req));
  else if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/ventes/') || /^\/icon-\d+\.png$/.test(url.pathname)) e.respondWith(cacheFirst(req));
});

self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: 'Obsimo Ventes', body: e.data?.text() };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Nouvelle vente', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/ventes/#/ventes' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/ventes/';
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const win = wins.find((w) => new URL(w.url).pathname.startsWith('/ventes'));
      if (win) {
        await win.focus();
        return win.navigate(url).catch(() => {});
      }
      return self.clients.openWindow(url);
    })(),
  );
});
