/**
 * Gatekeeper Service Worker
 * PWA 오프라인 지원을 위한 캐시 전략 구현
 */

const CACHE_NAME = 'gatekeeper-v1';

// 앱 셸로 프리캐시할 URL 목록
const APP_SHELL_URLS = [
  '/',
  '/manifest.json',
];

// install 이벤트: 앱 셸 리소스를 프리캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_URLS);
    })
  );
  // 새 SW가 즉시 활성화되도록 대기 건너뜀
  self.skipWaiting();
});

// activate 이벤트: 이전 버전 캐시 정리 및 즉시 제어 획득
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return clients.claim();
    })
  );
});

// fetch 이벤트: 캐시 우선 전략 + 네트워크 폴백
self.addEventListener('fetch', (event) => {
  // POST 등 non-GET 요청은 캐시하지 않음
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // 유효한 응답만 캐시에 저장
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // 네트워크 실패 시 루트 캐시로 폴백 (오프라인 셸)
        return caches.match('/');
      });
    })
  );
});
