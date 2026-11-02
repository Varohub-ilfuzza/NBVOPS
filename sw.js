// Service Worker — AirNubeiro ACARS PWA v4.7.3
// Red primero para la app (las actualizaciones se ven al instante) y
// caché solo como respaldo offline. Nunca cachea APIs ni el proxy local.
const CACHE_NAME = 'an-acars-v4.7.3';
const APP_SHELL = ['./', './index.html', './ops-center.html', './nbv-core.js', './nbv-ui.css', './manifest.json', './icons/nbv-mark.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // APIs externas, proxy local y health: siempre red, sin tocar caché
  if (url.origin !== self.location.origin || url.pathname.startsWith('/proxy') || url.pathname.startsWith('/__nbv')) return;
  e.respondWith(
    fetch(req).then(resp => {
      if (resp.ok) { const copy = resp.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
      return resp;
    }).catch(() => caches.match(req).then(c => c || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
