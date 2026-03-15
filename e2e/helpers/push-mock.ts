import { type Page } from '@playwright/test';

/**
 * E2E 테스트용 Web Push 모킹 헬퍼
 *
 * DLD-647: e2e 테스트 환경 구성
 *
 * 실제 Push 알림을 발송하지 않고 브라우저 API와 VAPID 엔드포인트를
 * 모킹하여 push 관련 기능을 테스트합니다.
 *
 * 모킹 전략:
 * - page.addInitScript(): PushManager, Notification 브라우저 API 모킹
 * - page.route(): VAPID 구독 관련 API 엔드포인트 인터셉트
 */

export interface MockPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * 테스트용 가짜 Push 구독 정보
 */
export const MOCK_PUSH_SUBSCRIPTION: MockPushSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/mock-e2e-test-endpoint',
  keys: {
    p256dh: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
    auth: 'UUxI4O8-HoGs86_GBRhFxGMpHMTKJmEXAZMFnTa5YCc',
  },
};

/**
 * 브라우저 내 PushManager 및 Notification API 모킹
 *
 * page.goto() 호출 전에 실행해야 합니다.
 * addInitScript는 페이지 로드 시마다 실행됩니다.
 *
 * @param page - Playwright Page 객체
 * @param options.initiallySubscribed - true이면 getSubscription()이 mock 구독 반환 (기본값: true)
 *   - true: 초기 구독 중 상태 (토글 OFF 테스트에 사용)
 *   - false: 초기 미구독 상태 (토글 ON 테스트에 사용)
 */
export async function mockBrowserPushAPIs(
  page: Page,
  options: { initiallySubscribed?: boolean } = {}
): Promise<void> {
  const { initiallySubscribed = true } = options;

  await page.addInitScript(
    ({ mockSubscription, initiallySubscribed }) => {
      // Notification API 모킹
      class MockNotification {
        static permission: NotificationPermission = 'granted';
        static requestPermission = async (): Promise<NotificationPermission> => 'granted';

        constructor(
          public title: string,
          public options?: NotificationOptions
        ) {}

        close() {}
        addEventListener() {}
        removeEventListener() {}
        dispatchEvent() { return true; }
      }

      // @ts-expect-error - 브라우저 전역 Notification 교체
      window.Notification = MockNotification;

      // stateful 구독 상태 플래그 초기화
      const win = window as unknown as Window & { __PUSH_SUBSCRIBED__: boolean };
      win.__PUSH_SUBSCRIBED__ = initiallySubscribed;

      // PushSubscription 모킹
      const mockPushSubscriptionObj = {
        endpoint: mockSubscription.endpoint,
        getKey: (name: string) => {
          const keys: Record<string, string> = {
            p256dh: mockSubscription.keys.p256dh,
            auth: mockSubscription.keys.auth,
          };
          const val = keys[name];
          if (!val) return null;
          // base64url → ArrayBuffer 변환
          const base64 = val.replace(/-/g, '+').replace(/_/g, '/');
          const binary = atob(base64);
          const buffer = new ArrayBuffer(binary.length);
          const bytes = new Uint8Array(buffer);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return buffer;
        },
        toJSON: () => ({
          endpoint: mockSubscription.endpoint,
          keys: mockSubscription.keys,
        }),
        unsubscribe: async () => {
          win.__PUSH_SUBSCRIBED__ = false;
          return true;
        },
      };

      // PushManager 모킹 (stateful)
      const MockPushManager = {
        getSubscription: async () => {
          return win.__PUSH_SUBSCRIBED__ ? mockPushSubscriptionObj : null;
        },
        subscribe: async () => {
          win.__PUSH_SUBSCRIBED__ = true;
          return mockPushSubscriptionObj;
        },
        permissionState: async () => 'granted' as PermissionState,
      };

      // SW 없는 환경(serviceWorkers: 'block')을 위한 fakeRegistration
      const fakeRegistration = {
        active: { state: 'activated' },
        installing: null,
        waiting: null,
        scope: '/',
        updateViaCache: 'none' as ServiceWorkerUpdateViaCache,
        pushManager: MockPushManager,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        update: async () => {},
        unregister: async () => true,
        showNotification: async () => {},
        getNotifications: async () => [],
        navigationPreload: {
          enable: async () => {},
          disable: async () => {},
          setHeaderValue: async () => {},
          getState: async () => ({ enabled: false, headerValue: '' }),
        },
        sync: { register: async () => {}, getTags: async () => [] },
        periodicSync: { register: async () => {}, unregister: async () => {}, getTags: async () => [] },
        index: { add: async () => {}, delete: async () => {}, getAll: async () => [] },
        cookies: { getAll: async () => [], set: async () => {}, delete: async () => {} },
        backgroundFetch: {
          fetch: async () => ({}),
          get: async () => undefined,
          getIds: async () => [],
        },
        paymentManager: { userHint: '', instruments: { keys: async () => [], has: async () => false, get: async () => undefined, set: async () => {}, delete: async () => false, clear: async () => {}, entries: async () => [], values: async () => [], forEach: async () => {} } },
        onupdatefound: null,
      };

      // ServiceWorkerRegistration에 PushManager 주입
      const originalGetRegistration =
        navigator.serviceWorker?.getRegistration?.bind(navigator.serviceWorker);

      if (navigator.serviceWorker) {
        Object.defineProperty(navigator.serviceWorker, 'getRegistration', {
          value: async (...args: Parameters<typeof originalGetRegistration>) => {
            const registration = originalGetRegistration
              ? await originalGetRegistration(...args)
              : undefined;
            if (registration) {
              Object.defineProperty(registration, 'pushManager', {
                get: () => MockPushManager,
                configurable: true,
              });
              return registration;
            }
            // SW가 없거나 차단된 환경에서는 fakeRegistration 반환
            return fakeRegistration;
          },
          configurable: true,
        });
      }

      // window에 직접 모킹 플래그 노출 (테스트에서 확인 가능)
      (window as unknown as Window & { __E2E_PUSH_MOCKED__: boolean }).__E2E_PUSH_MOCKED__ = true;
    },
    { mockSubscription: MOCK_PUSH_SUBSCRIPTION, initiallySubscribed }
  );
}

/**
 * Push 구독 API 엔드포인트 모킹
 *
 * 실제 서버로의 push 구독 요청을 인터셉트하여 가짜 응답을 반환합니다.
 */
export async function mockPushSubscriptionRoutes(
  page: Page,
  options: { failSubscription?: boolean } = {}
): Promise<void> {
  const { failSubscription = false } = options;

  // POST /api/me/push/subscribe 인터셉트
  await page.route('**/api/me/push/subscribe', async (route) => {
    if (failSubscription) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Push subscription failed (mocked)' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        subscriptionId: 'mock-subscription-id-001',
      }),
    });
  });

  // DELETE /api/me/push/unsubscribe 인터셉트
  await page.route('**/api/me/push/unsubscribe', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // POST /api/push/send (서버→클라이언트 push 발송) 인터셉트
  await page.route('**/api/push/send', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, sent: 1 }),
    });
  });
}

/**
 * Push API 모킹 전체 적용 (브라우저 API + 라우트)
 *
 * 초기 상태: 미구독 (initiallySubscribed: false)
 * 토글 ON 테스트에 적합합니다.
 * 토글 OFF 테스트는 mockBrowserPushAPIs + mockPushSubscriptionRoutes를 직접 사용하세요.
 */
export async function setupPushMocks(
  page: Page,
  options: { failSubscription?: boolean } = {}
): Promise<void> {
  // initiallySubscribed: false — 토글 ON 테스트를 위해 초기 미구독 상태로 설정
  await mockBrowserPushAPIs(page, { initiallySubscribed: false });
  await mockPushSubscriptionRoutes(page, options);
}
