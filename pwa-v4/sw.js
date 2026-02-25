// Service Worker — ACARS Dispatch AirNubeiro PWA
const CACHE_NAME = 'an-acars-v4.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap'
];

// Install — cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - API calls (hoppie, simbrief, ivao, aviationweather) → network only
// - App shell / fonts → cache first, network fallback
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Network-only for API calls
  if (
    url.includes('hoppie.nl') ||
    url.includes('simbrief.com') ||
    url.includes('ivao.aero') ||
    url.includes('aviationweather.gov') ||
    url.includes('corsproxy.io')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        // Cache successful GET requests
        if (resp.ok && e.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      });
    }).catch(() => {
      // Offline fallback for navigation
      if (e.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
