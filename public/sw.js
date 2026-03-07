/**
 * Gatekeeper Service Worker
 * PWA 오프라인 지원을 위한 캐시 전략 구현
 */

const CACHE_NAME = 'gatekeeper-v1';

// 앱 셸로 프리캐시할 URL 목록 (참조용 - fetch 핸들러 및 클라이언트 측 캐싱에서 사용)
const APP_SHELL_URLS = [
  '/',
  '/manifest.json',
];

// install 이벤트: 프리캐시 없이 즉시 설치 완료하여 빠르게 activated 상태로 전환
self.addEventListener('install', (event) => {
  // waitUntil에 아무것도 넣지 않으면 install이 즉시 완료되어 activate로 바로 진행됨
  // cache.addAll 및 cache.put은 fetch 핸들러와 클라이언트 측 캐싱에서 사용됨
  event.waitUntil(Promise.resolve());
  // 새 SW가 즉시 활성화되도록 대기 건너뜀
  self.skipWaiting();
});

// activate 이벤트: 이전 버전 캐시 정리 및 즉시 제어 획득
self.addEventListener('activate', (event) => {
  event.waitUntil(
    clients.claim().then(() => {
      // SW 활성화 후 즉시 앱 셸을 캐시
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(APP_SHELL_URLS).catch(() => {
          // 프리캐시 실패해도 activate는 완료
        });
      });
    })
  );

  // 구버전 캐시 정리는 비동기
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
