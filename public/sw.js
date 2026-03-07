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

// install 이벤트: skipWaiting으로 즉시 활성화, 프리캐시 실패해도 설치 계속
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_URLS).catch(() => {
        // 프리캐시 실패해도 SW 설치는 계속 진행
        console.log('Pre-cache failed, will cache on first fetch');
      });
    })
  );
  // 새 SW가 즉시 활성화되도록 대기 건너뜀
  self.skipWaiting();
});

// activate 이벤트: 이전 버전 캐시 정리 및 즉시 제어 획득
self.addEventListener('activate', (event) => {
  // clients.claim()만 waitUntil에 포함하여 빠르게 'activated' 상태로 전환
  event.waitUntil(clients.claim());

  // 구버전 캐시 정리는 비동기로 처리 (activated 전환을 막지 않음)
  caches.keys().then((cacheNames) => {
    return Promise.all(
      cacheNames
        .filter((name) => name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );
  });
});

// fetch 이벤트: Navigation 요청은 network-first, 나머지는 cache-first
self.addEventListener('fetch', (event) => {
  // POST 등 non-GET 요청은 캐시하지 않음
  if (event.request.method !== 'GET') {
    return;
  }

  // Navigation 요청 (HTML 페이지): network-first + 응답을 캐시에 저장
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // 네트워크 실패 시 캐시된 셸로 폴백
          return caches.match('/');
        })
    );
    return;
  }

  // 그 외 요청: cache-first + 네트워크 폴백
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
