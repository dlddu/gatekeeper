/**
 * Gatekeeper Service Worker
 * PWA 오프라인 지원을 위한 캐시 전략 구현
 */

const CACHE_NAME = 'gatekeeper-v1';

// 앱 셸로 프리캐시할 URL 목록 (참조용 - fetch 핸들러 및 클라이언트 측 캐싱에서 사용)
const APP_SHELL_URLS = [
  '/',
  '/requests',
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
        // 각 URL을 개별적으로 캐시 (리다이렉트 등으로 실패해도 다른 URL 캐싱 계속 진행)
        return Promise.all(
          APP_SHELL_URLS.map((url) =>
            cache.add(url).catch(() => {
              // 리다이렉트 등으로 실패 가능, 무시
            })
          )
        );
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
          // 오프라인: 현재 URL 캐시 → '/requests' 캐시 → '/' 캐시 순으로 시도
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return caches.match('/requests').then((reqCached) => {
              if (reqCached) return reqCached;
              return caches.match('/');
            });
          });
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
