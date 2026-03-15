import { test, expect } from '@playwright/test';
import { TEST_USERS } from './helpers/auth';
import {
  mockBrowserPushAPIs,
  mockPushSubscriptionRoutes,
  setupPushMocks,
} from './helpers/push-mock';

/**
 * 설정 페이지 Push 알림 토글 E2E 테스트
 *
 * DLD-771: 작업 10-1: [설정 페이지 — Push 알림 토글] e2e 테스트 작성 (skipped)
 * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
 *
 * 커버리지:
 * - 설정 페이지 접근 시 "설정" 헤더 + Push 알림 토글 렌더링 확인
 * - BottomNav "설정" 탭 aria-current="page" active 상태 확인
 * - Push 미지원 브라우저 → 토글 disabled + 안내 문구 확인
 * - 알림 권한 denied 상태 → 토글 disabled + 차단 안내 문구 확인
 * - 토글 ON → POST /api/me/push/subscribe 호출 + 활성화 안내 텍스트 확인
 * - 토글 OFF → DELETE /api/me/push/unsubscribe 호출 + 기본 안내 텍스트 복귀 확인
 * - 미인증 상태로 접근 → /login 리다이렉트 확인
 *
 * TODO: DLD-772 구현 완료 후 test.describe.skip → test.describe 로 변경
 */

test.describe.skip('설정 페이지 Push 알림 토글 (/settings)', () => {
  test.beforeEach(async ({ page }) => {
    // 관리자 로그인 (UI 기반)
    await page.goto('/login');
    await page.getByLabel('아이디').fill(TEST_USERS.admin.username);
    await page.getByLabel('비밀번호').fill(TEST_USERS.admin.password);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page).toHaveURL('/requests');
  });

  // --- happy path ---

  test('설정 페이지에 접근하면 "설정" 헤더와 Push 알림 토글이 렌더링된다 (happy path)', async ({
    page,
  }) => {
    // Arrange: Push API 모킹 (page.goto 전에 호출해야 함)
    await mockBrowserPushAPIs(page);

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
    // Arrange: Push API 모킹
    await mockBrowserPushAPIs(page);

    // Act: 설정 페이지로 이동
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

    // Assert: 하단 네비게이션에서 "설정" 탭이 active 상태
    const settingsNavItem = page.getByRole('link', { name: '설정' });
    await expect(settingsNavItem).toBeVisible();
    await expect(settingsNavItem).toHaveAttribute('aria-current', 'page');
  });

  test('토글을 ON으로 전환하면 POST /api/me/push/subscribe가 호출되고 "알림이 활성화되어 있습니다" 텍스트가 표시된다 (happy path)', async ({
    page,
  }) => {
    // Arrange: Push API 모킹 + 구독 API 라우트 모킹 (SW 차단 필요)
    await setupPushMocks(page);

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
  });

  test('토글을 OFF로 전환하면 DELETE /api/me/push/unsubscribe가 호출되고 기본 안내 텍스트로 복귀한다 (happy path)', async ({
    page,
  }) => {
    // Arrange: Push API 모킹 + 구독 API 라우트 모킹
    await setupPushMocks(page);

    // Act: 설정 페이지로 이동 (초기 상태: 구독 중 — mockBrowserPushAPIs가 getSubscription → mock 반환)
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

    // Arrange: 구독 해제 API 호출 대기 준비
    const unsubscribePromise = page.waitForRequest(
      (req) =>
        req.url().includes('/api/me/push/unsubscribe') && req.method() === 'DELETE'
    );

    // Act: 토글 OFF (현재 ON 상태에서 클릭)
    await page.getByRole('switch', { name: /push/i }).click();

    // Assert: DELETE /api/me/push/unsubscribe 호출됨
    await unsubscribePromise;

    // Assert: 기본 안내 텍스트로 복귀 ("알림이 활성화되어 있습니다" 사라짐)
    await expect(page.getByText('알림이 활성화되어 있습니다')).not.toBeVisible();
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

/**
 * Service Worker가 page.route() 인터셉트를 방해하는 경우에 대비하여
 * API 호출 검증 테스트는 별도 describe 블록에서 SW를 비활성화합니다.
 */
test.describe.skip('설정 페이지 Push 토글 API 연동 (SW 차단)', () => {
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ page }) => {
    // 관리자 로그인 (UI 기반)
    await page.goto('/login');
    await page.getByLabel('아이디').fill(TEST_USERS.admin.username);
    await page.getByLabel('비밀번호').fill(TEST_USERS.admin.password);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page).toHaveURL('/requests');
  });

  test('토글 ON 시 POST /api/me/push/subscribe 요청이 실제로 인터셉트된다 (happy path)', async ({
    page,
  }) => {
    // Arrange: Push API 모킹 + 라우트 인터셉트 설정
    await mockBrowserPushAPIs(page);
    await mockPushSubscriptionRoutes(page);

    // Act: 설정 페이지로 이동
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

    // Arrange: 구독 API 요청 대기
    const subscribeRequest = page.waitForRequest(
      (req) =>
        req.url().includes('/api/me/push/subscribe') && req.method() === 'POST'
    );

    // Act: 토글 ON 클릭
    await page.getByRole('switch', { name: /push/i }).click();

    // Assert: POST /api/me/push/subscribe 요청이 발생함
    const req = await subscribeRequest;
    expect(req.method()).toBe('POST');
    expect(req.url()).toContain('/api/me/push/subscribe');

    // Assert: 활성화 안내 텍스트 표시
    await expect(page.getByText('알림이 활성화되어 있습니다')).toBeVisible();
  });

  test('토글 OFF 시 DELETE /api/me/push/unsubscribe 요청이 실제로 인터셉트된다 (happy path)', async ({
    page,
  }) => {
    // Arrange: Push API 모킹 + 라우트 인터셉트 설정 (getSubscription → mock 반환으로 초기 ON 상태)
    await mockBrowserPushAPIs(page);
    await mockPushSubscriptionRoutes(page);

    // Act: 설정 페이지로 이동
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

    // Arrange: 구독 해제 API 요청 대기
    const unsubscribeRequest = page.waitForRequest(
      (req) =>
        req.url().includes('/api/me/push/unsubscribe') && req.method() === 'DELETE'
    );

    // Act: 토글 OFF 클릭 (현재 ON 상태)
    await page.getByRole('switch', { name: /push/i }).click();

    // Assert: DELETE /api/me/push/unsubscribe 요청이 발생함
    const req = await unsubscribeRequest;
    expect(req.method()).toBe('DELETE');
    expect(req.url()).toContain('/api/me/push/unsubscribe');

    // Assert: 기본 안내 텍스트로 복귀
    await expect(page.getByText('알림이 활성화되어 있습니다')).not.toBeVisible();
  });
});
