import { test, expect, type Page } from '@playwright/test';
import { loginViaAPI } from './helpers/auth';
import {
  cleanupPushSubscriptions,
  createTestPushSubscription,
  findPushSubscriptionByEndpoint,
  findUserByUsername,
} from './helpers/db';

/**
 * 설정 페이지 Push 알림 토글 E2E 테스트
 *
 * DLD-771: 작업 10-1: [설정 페이지 — Push 알림 토글] e2e 테스트 작성
 * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
 *
 * 전략 (Option B):
 * - 브라우저 Push API(Notification, PushManager)는 인라인 모킹 (headless에서 필수)
 * - API 라우트 모킹(page.route()) 없음 → 실제 백엔드 API 호출
 * - DB 헬퍼로 구독 레코드 생성/삭제 검증
 * - push-mock.ts 파일 import 없음
 *
 * 커버리지:
 * - 설정 페이지 접근 시 "설정" 헤더 + Push 알림 토글 렌더링 확인
 * - BottomNav "설정" 탭 aria-current="page" active 상태 확인
 * - 토글 ON → 실제 POST /api/me/push/subscribe + DB 검증
 * - 토글 OFF → DB 시드 + 실제 DELETE /api/me/push/unsubscribe + DB 검증
 * - Push 미지원 브라우저 → 토글 disabled + 안내 문구 확인
 * - 알림 권한 denied 상태 → 토글 disabled + 차단 안내 문구 확인
 * - 미인증 상태로 접근 → /login 리다이렉트 확인
 */

// --- 인라인 브라우저 모킹 상수 ---
const MOCK_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/e2e-settings-test';
const MOCK_P256DH = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const MOCK_AUTH = 'UUxI4O8-HoGs86_GBRhFxGMpHMTKJmEXAZMFnTa5YCc';

/**
 * 인라인 브라우저 Push API 모킹
 *
 * push-mock.ts의 mockBrowserPushAPIs와 동일한 로직이지만:
 * - settings.e2e.ts 내에 인라인으로 정의 (push-mock.ts import 제거)
 * - API 라우트 모킹(page.route()) 없음 → 실제 백엔드 호출
 */
async function mockBrowserPushAPIsInline(
  page: Page,
  options: { initiallySubscribed?: boolean } = {}
): Promise<void> {
  const { initiallySubscribed = true } = options;

  await page.addInitScript(
    ({ endpoint, p256dh, auth, initiallySubscribed }) => {
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
        endpoint,
        getKey: (name: string) => {
          const keys: Record<string, string> = { p256dh, auth };
          const val = keys[name];
          if (!val) return null;
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
          endpoint,
          keys: { p256dh, auth },
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

      // fakeRegistration
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
            return fakeRegistration;
          },
          configurable: true,
        });
      }
    },
    { endpoint: MOCK_ENDPOINT, p256dh: MOCK_P256DH, auth: MOCK_AUTH, initiallySubscribed }
  );
}

test.describe('설정 페이지 Push 알림 토글 (/settings)', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginViaAPI(page, request);
    await page.goto('/requests');
  });

  test.afterEach(async () => {
    // DB에서 admin 사용자의 push 구독 정리
    await cleanupPushSubscriptions('admin');
  });

  // --- happy path ---

  test('설정 페이지에 접근하면 "설정" 헤더와 Push 알림 토글이 렌더링된다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 브라우저 Push API 인라인 모킹
    await mockBrowserPushAPIsInline(page);

    // Act: 설정 페이지로 이동
    await page.goto('/settings');

    // Assert: 페이지 헤더 표시
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

    // Assert: Push 알림 토글이 표시됨
    await expect(page.getByRole('switch', { name: /push/i })).toBeVisible();
  });

  test('설정 페이지에서 BottomNav "설정" 탭이 aria-current="page" active 상태로 표시된다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 브라우저 Push API 인라인 모킹
    await mockBrowserPushAPIsInline(page);

    // Act: 설정 페이지로 이동
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

    // Assert: 하단 네비게이션에서 "설정" 탭이 active 상태
    const settingsNavItem = page.getByRole('link', { name: '설정' });
    await expect(settingsNavItem).toBeVisible();
    await expect(settingsNavItem).toHaveAttribute('aria-current', 'page');
  });

  test('토글을 ON으로 전환하면 실제 구독이 생성되고 "알림이 활성화되어 있습니다" 텍스트가 표시된다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 브라우저 Push API 인라인 모킹 (초기 미구독 상태)
    await mockBrowserPushAPIsInline(page, { initiallySubscribed: false });

    // Act: 설정 페이지로 이동
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

    // Arrange: 구독 API 호출 대기 준비
    const subscribePromise = page.waitForRequest(
      (req) =>
        req.url().includes('/api/me/push/subscribe') && req.method() === 'POST'
    );

    // Act: 토글 ON
    await page.getByRole('switch', { name: /push/i }).click();

    // Assert: POST /api/me/push/subscribe 호출됨
    await subscribePromise;

    // Assert: 활성화 안내 텍스트 표시
    await expect(page.getByText('알림이 활성화되어 있습니다')).toBeVisible();

    // Assert: DB에 구독 레코드가 실제로 생성됨
    const sub = await findPushSubscriptionByEndpoint(MOCK_ENDPOINT);
    expect(sub).not.toBeNull();
  });

  test('토글을 OFF로 전환하면 구독이 해제되고 기본 안내 텍스트로 복귀한다 (happy path)', async ({
    page,
  }) => {
    // Arrange: DB에 구독 레코드 직접 시드 (초기 구독 상태)
    const user = await findUserByUsername('admin');
    expect(user).not.toBeNull();
    await createTestPushSubscription({
      userId: user!.id,
      endpoint: MOCK_ENDPOINT,
      p256dh: MOCK_P256DH,
      auth: MOCK_AUTH,
    });

    // Arrange: 브라우저 Push API 인라인 모킹 (초기 구독 중 상태)
    await mockBrowserPushAPIsInline(page, { initiallySubscribed: true });

    // Act: 설정 페이지로 이동 (초기 상태: 구독 중)
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

    // Assert: 초기 상태가 ON(구독 중)임을 명시적으로 확인
    await expect(page.getByRole('switch', { name: /push/i })).toBeChecked();

    // Arrange: 구독 해제 API 호출 대기 준비
    const unsubscribePromise = page.waitForRequest(
      (req) =>
        req.url().includes('/api/me/push/unsubscribe') && req.method() === 'DELETE'
    );

    // Act: 토글 OFF
    await page.getByRole('switch', { name: /push/i }).click();

    // Assert: DELETE /api/me/push/unsubscribe 호출됨
    await unsubscribePromise;

    // Assert: 활성화 안내 텍스트가 사라짐
    await expect(page.getByText('알림이 활성화되어 있습니다')).not.toBeVisible();

    // Assert: 기본 안내 텍스트로 복귀
    await expect(
      page.getByText('Push 알림을 활성화하면 승인 요청 알림을 받을 수 있습니다')
    ).toBeVisible();

    // Assert: DB에서 구독 레코드가 실제로 삭제됨
    const sub = await findPushSubscriptionByEndpoint(MOCK_ENDPOINT);
    expect(sub).toBeNull();
  });

  // --- edge case ---

  test('Push를 지원하지 않는 브라우저에서는 토글이 disabled이고 안내 문구가 표시된다 (edge case)', async ({
    page,
  }) => {
    // Arrange: Notification API를 undefined로 설정하여 Push 미지원 브라우저 시뮬레이션
    await page.addInitScript(() => {
      // @ts-expect-error - Push 미지원 브라우저 시뮬레이션
      delete window.Notification;
      // @ts-expect-error - PushManager 미지원 시뮬레이션
      delete window.PushManager;
    });

    // Act: 설정 페이지로 이동
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

    // Assert: 토글이 disabled 상태
    await expect(page.getByRole('switch', { name: /push/i })).toBeDisabled();

    // Assert: Push 미지원 안내 문구 표시
    await expect(
      page.getByText('이 브라우저는 Push 알림을 지원하지 않습니다')
    ).toBeVisible();
  });

  test('알림 권한이 denied 상태이면 토글이 disabled이고 차단 안내 문구가 표시된다 (edge case)', async ({
    page,
  }) => {
    // Arrange: Notification.permission = 'denied' 모킹
    await page.addInitScript(() => {
      class MockNotificationDenied {
        static permission: NotificationPermission = 'denied';
        static requestPermission = async (): Promise<NotificationPermission> => 'denied';

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
      window.Notification = MockNotificationDenied;
    });

    // Act: 설정 페이지로 이동
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

    // Assert: 토글이 disabled 상태
    await expect(page.getByRole('switch', { name: /push/i })).toBeDisabled();

    // Assert: 권한 차단 안내 문구 표시
    await expect(
      page.getByText('브라우저에서 알림 권한이 차단되었습니다')
    ).toBeVisible();
  });

  // --- error case ---

  test('미인증 상태로 /settings에 접근하면 /login으로 리다이렉트된다 (error case)', async ({
    browser,
  }) => {
    // Arrange: 로그인하지 않은 새 브라우저 컨텍스트 (beforeEach 로그인 우회)
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Act: 미인증 상태로 설정 페이지 직접 접근
      await page.goto('/settings');

      // Assert: /login으로 리다이렉트
      await expect(page).toHaveURL('/login');
    } finally {
      await context.close();
    }
  });
});
