const CACHE_NAME = 'lfs-offline-v1';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/wsClient.js',
  '/js/qrClient.js',
  '/js/transferEngine.js',
  '/manifest.json',
  '/icons/icon.svg'
];

// Install Event: Pre-cache all core static assets for offline use
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[LFS SW] Caching offline assets...');
      return cache.addAll(OFFLINE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-While-Revalidate for static assets, bypass API/WS/transfer endpoints
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore WebSocket and dynamic transfer API endpoints
  if (url.pathname.startsWith('/ws') || url.pathname.startsWith('/api/transfer')) {
    return;
  }

  // Network-First for /api/info
  if (url.pathname === '/api/info') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-First for static assets (HTML, CSS, JS, SVG, Fonts)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in background
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        return networkResponse;
      }).catch(() => {
        // Fallback to offline index.html if navigating
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
