import { test, expect } from '@playwright/test';
import { loginAsAdmin, withAuthHeader } from './helpers/auth';
import { setupPushMocks, mockPushSubscriptionRoutes, MOCK_PUSH_SUBSCRIPTION } from './helpers/push-mock';

/**
 * Web Push 구독 E2E 테스트
 *
 * DLD-647: e2e 테스트 환경 구성
 * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
 *
 * 커버리지:
 * - POST /api/me/push/subscribe (Push 구독 등록)
 * - DELETE /api/me/push/unsubscribe (Push 구독 해제)
 * - 브라우저 PushManager/Notification API 모킹
 * - VAPID 엔드포인트 인터셉트
 *
 * 전략:
 * - page.addInitScript()로 브라우저 PushManager, Notification API 모킹
 * - page.route()로 push 관련 API 엔드포인트 인터셉트
 * - 실제 web-push 패키지 호출 없이 E2E 플로우 검증
 *
 * Activated for DLD-661
 */

test.describe('POST /api/me/push/subscribe (Push 구독 API)', () => {
  test('유효한 구독 정보로 등록하면 201을 반환한다 (happy path)', async ({ request }) => {
    const { token } = await loginAsAdmin(request);

    const response = await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(token),
      data: {
        endpoint: MOCK_PUSH_SUBSCRIPTION.endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body.endpoint).toBe(MOCK_PUSH_SUBSCRIPTION.endpoint);
  });

  test('동일한 endpoint로 중복 구독하면 기존 구독을 반환하거나 200을 반환한다 (edge case)', async ({
    request,
  }) => {
    const { token } = await loginAsAdmin(request);

    // 첫 번째 구독
    await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(token),
      data: {
        endpoint: MOCK_PUSH_SUBSCRIPTION.endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // 두 번째 구독 (동일 endpoint)
    const response = await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(token),
      data: {
        endpoint: MOCK_PUSH_SUBSCRIPTION.endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // 409 Conflict 또는 200 OK (upsert) 중 하나
    expect([200, 201, 409]).toContain(response.status());
  });

  test('인증 없이 구독 등록하면 401을 반환한다 (error case)', async ({ request }) => {
    const response = await request.post('/api/me/push/subscribe', {
      data: {
        endpoint: MOCK_PUSH_SUBSCRIPTION.endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    expect(response.status()).toBe(401);
  });

  test('endpoint 없이 구독 등록하면 400을 반환한다 (error case)', async ({ request }) => {
    const { token } = await loginAsAdmin(request);

    const response = await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(token),
      data: {
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    expect(response.status()).toBe(400);
  });

  test('p256dh 없이 구독 등록하면 400을 반환한다 (error case)', async ({ request }) => {
    const { token } = await loginAsAdmin(request);

    const response = await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(token),
      data: {
        endpoint: MOCK_PUSH_SUBSCRIPTION.endpoint,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    expect(response.status()).toBe(400);
  });

  test('auth 없이 구독 등록하면 400을 반환한다 (error case)', async ({ request }) => {
    const { token } = await loginAsAdmin(request);

    const response = await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(token),
      data: {
        endpoint: MOCK_PUSH_SUBSCRIPTION.endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
      },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe('DELETE /api/me/push/unsubscribe (Push 구독 해제)', () => {
  test('등록된 구독을 해제하면 200을 반환한다 (happy path)', async ({ request }) => {
    const { token } = await loginAsAdmin(request);

    // 먼저 구독 등록
    await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(token),
      data: {
        endpoint: `${MOCK_PUSH_SUBSCRIPTION.endpoint}-for-unsub`,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // 구독 해제
    const response = await request.delete('/api/me/push/unsubscribe', {
      ...withAuthHeader(token),
      data: { endpoint: `${MOCK_PUSH_SUBSCRIPTION.endpoint}-for-unsub` },
    });

    expect(response.status()).toBe(200);
  });

  test('인증 없이 구독 해제하면 401을 반환한다 (error case)', async ({ request }) => {
    const response = await request.delete('/api/me/push/unsubscribe', {
      data: { endpoint: MOCK_PUSH_SUBSCRIPTION.endpoint },
    });

    expect(response.status()).toBe(401);
  });

  test('존재하지 않는 endpoint로 해제하면 404를 반환한다 (edge case)', async ({ request }) => {
    const { token } = await loginAsAdmin(request);

    const response = await request.delete('/api/me/push/unsubscribe', {
      ...withAuthHeader(token),
      data: { endpoint: 'https://nonexistent.endpoint.example.com/push' },
    });

    expect(response.status()).toBe(404);
  });
});

test.describe('브라우저 Push 모킹 (page.addInitScript + page.route)', () => {
  // 서비스 워커가 fetch 이벤트를 가로채면 page.route()가 요청을 인터셉트하지 못함
  test.use({ serviceWorkers: 'block' });

  test('브라우저 PushManager API가 모킹된 상태로 초기화된다 (happy path)', async ({ page }) => {
    await setupPushMocks(page);

    await page.goto('/');

    // 모킹 플래그 확인
    const isMocked = await page.evaluate(() => {
      return (window as Window & { __E2E_PUSH_MOCKED__?: boolean }).__E2E_PUSH_MOCKED__;
    });
    expect(isMocked).toBe(true);
  });

  test('Notification.permission이 granted로 모킹된다 (happy path)', async ({ page }) => {
    await setupPushMocks(page);

    await page.goto('/');

    const permission = await page.evaluate(() => Notification.permission);
    expect(permission).toBe('granted');
  });

  test('Notification.requestPermission()이 granted를 반환한다 (happy path)', async ({
    page,
  }) => {
    await setupPushMocks(page);

    await page.goto('/');

    const permission = await page.evaluate(async () => Notification.requestPermission());
    expect(permission).toBe('granted');
  });

  test('page.route로 /api/me/push/subscribe 요청이 인터셉트된다 (happy path)', async ({
    page,
  }) => {
    await mockPushSubscriptionRoutes(page);

    await page.goto('/');

    // 페이지에서 fetch로 구독 API 호출
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/me/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'https://mock.endpoint/push',
          p256dh: 'mock-p256dh',
          auth: 'mock-auth',
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.subscriptionId).toBe('mock-subscription-id-001');
  });

  test('failSubscription 옵션으로 구독 실패 시나리오를 테스트할 수 있다 (error case)', async ({
    page,
  }) => {
    await mockPushSubscriptionRoutes(page, { failSubscription: true });

    await page.goto('/');

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/me/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'https://mock.endpoint/push',
          p256dh: 'mock-p256dh',
          auth: 'mock-auth',
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/failed/i);
  });

  test('/api/me/push/unsubscribe 라우트가 모킹된다 (happy path)', async ({ page }) => {
    await mockPushSubscriptionRoutes(page);

    await page.goto('/');

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/me/push/unsubscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'https://mock.endpoint/push' }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
