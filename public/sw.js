const CACHE_NAME = 'gatekeeper-v1';
const STATIC_ASSETS = [
  '/manifest.json',
];

// install event: precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Offline fallback HTML shell
const OFFLINE_HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gatekeeper</title><style>body{font-family:system-ui,sans-serif;margin:0;padding:0;background:#f9fafb;color:#111827}h1{margin:0;padding:24px;font-size:20px}.offline-msg{padding:24px;text-align:center;color:#6b7280}</style></head><body><div data-testid="app-shell"><main><h1>Gatekeeper</h1><div class="offline-msg"><div data-testid="offline-indicator">오프라인 상태입니다. 네트워크 연결을 확인해주세요.</div></div></main></div><script>window.addEventListener("online",function(){window.location.reload()});</script></body></html>';

// push event: display push notification
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title || 'Gatekeeper';
  const options = {
    body: data.body || '',
    icon: '/icon-192x192.png',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// notification click: open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('/');
    })
  );
});

// fetch event: network-first for navigation, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Navigation requests (HTML documents)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(OFFLINE_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      })
    );
    return;
  }

  // Non-navigation requests: cache-first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).catch(() => {
        // offline fallback for non-navigation requests
        return new Response('', { status: 503 });
      });
    })
  );
});
