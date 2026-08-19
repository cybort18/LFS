const CACHE_NAME = 'lfs-offline-v3';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/wsClient.js',
  '/js/qrClient.js',
  '/js/transferEngine.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon_1.svg',
  '/icons/icon_landscape.svg',
  '/icons/icon_landscape_transparant.svg'
];

// Install Event: Pre-cache all core static assets for offline use
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[LFS SW] Caching fresh offline assets (v3)...');
      return cache.addAll(OFFLINE_ASSETS);
    })
  );
});

// Activate Event: Clean up all outdated caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[LFS SW] Deleting obsolete cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-First for HTML/navigation, Stale-While-Revalidate for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore WebSocket and dynamic transfer API endpoints
  if (url.pathname.startsWith('/ws') || url.pathname.startsWith('/api/transfer')) {
    return;
  }

  // Network-First for HTML navigation and /api/info so updates show up immediately
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/api/info') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request).then((res) => res || caches.match('/index.html')))
    );
    return;
  }

  // Cache-First with background revalidation for static assets (CSS, JS, SVG, Fonts)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
