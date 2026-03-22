import { test, expect } from '@playwright/test';
import { loginAsAdmin, withAuthHeader, forwardAuthHeaders, TEST_USERS } from './helpers/auth';
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

// 글로벌 시드 데이터의 externalId (global-setup.ts에서 생성)
const SEED_PENDING_EXTERNAL_ID = 'e2e-pending-001';
const SEED_TIMEOUT_EXTERNAL_ID = 'e2e-timeout-001';

test.describe('POST /api/me/push/subscribe (Push 구독 API)', () => {
  test('유효한 구독 정보로 등록하면 201을 반환한다 (happy path)', async ({ request }) => {
    const { authentikUid } = await loginAsAdmin(request);

    const response = await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
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
    const { authentikUid } = await loginAsAdmin(request);

    // 첫 번째 구독
    await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        endpoint: MOCK_PUSH_SUBSCRIPTION.endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // 두 번째 구독 (동일 endpoint)
    const response = await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
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
    const { authentikUid } = await loginAsAdmin(request);

    const response = await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    expect(response.status()).toBe(400);
  });

  test('p256dh 없이 구독 등록하면 400을 반환한다 (error case)', async ({ request }) => {
    const { authentikUid } = await loginAsAdmin(request);

    const response = await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        endpoint: MOCK_PUSH_SUBSCRIPTION.endpoint,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    expect(response.status()).toBe(400);
  });

  test('auth 없이 구독 등록하면 400을 반환한다 (error case)', async ({ request }) => {
    const { authentikUid } = await loginAsAdmin(request);

    const response = await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
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
    const { authentikUid } = await loginAsAdmin(request);

    // 먼저 구독 등록
    await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        endpoint: `${MOCK_PUSH_SUBSCRIPTION.endpoint}-for-unsub`,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // 구독 해제
    const response = await request.delete('/api/me/push/unsubscribe', {
      ...withAuthHeader(authentikUid),
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
    const { authentikUid } = await loginAsAdmin(request);

    const response = await request.delete('/api/me/push/unsubscribe', {
      ...withAuthHeader(authentikUid),
      data: { endpoint: 'https://nonexistent.endpoint.example.com/push' },
    });

    expect(response.status()).toBe(404);
  });
});

test.describe('브라우저 Push 모킹 (page.addInitScript + page.route)', () => {

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

// TODO: Activate when DLD-827 is implemented
test.describe.skip('GET /api/me/requests/pending — Forward Auth 전환 (DLD-827)', () => {
  /**
   * DLD-827: Forward Auth 기반 인증으로 전환
   *
   * 기존 loginAsAdmin(request) + withAuthHeader(auth.authentikUid) 2단계 호출을
   * forwardAuthHeaders(TEST_USERS.admin) 1단계 호출로 대체합니다.
   *
   * 검증 항목:
   * - Bearer 토큰 없이 Forward Auth 헤더만으로 pending 목록 조회 가능
   * - 응답 형식: { requests: [...], count: number }
   */

  test('Forward Auth 헤더만으로 pending 요청 목록을 조회하면 200과 올바른 형식을 반환한다 (happy path)', async ({
    request,
  }) => {
    // Act: Bearer 토큰 없이 Forward Auth 헤더만으로 pending 목록 조회 (1단계 호출)
    const response = await request.get('/api/me/requests/pending', forwardAuthHeaders(TEST_USERS.admin));

    // Assert
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('requests');
    expect(body).toHaveProperty('count');
    expect(Array.isArray(body.requests)).toBe(true);
    expect(typeof body.count).toBe('number');
  });

  test('Forward Auth 헤더로 조회한 pending 목록에 PENDING 상태 요청만 포함된다 (happy path)', async ({
    request,
  }) => {
    // Act: Forward Auth 헤더로 pending 목록 조회
    const response = await request.get('/api/me/requests/pending', forwardAuthHeaders(TEST_USERS.admin));

    expect(response.status()).toBe(200);

    const body = await response.json();

    // Assert: 모든 항목이 PENDING 상태여야 함
    const allPending = body.requests.every(
      (r: { status: string }) => r.status === 'PENDING'
    );
    expect(allPending).toBe(true);
  });

  test('Forward Auth 헤더 없이 요청하면 401을 반환한다 (error case)', async ({ request }) => {
    // Act: 인증 헤더 없이 pending 목록 조회 시도
    const response = await request.get('/api/me/requests/pending');

    // Assert
    expect(response.status()).toBe(401);
  });
});

// TODO: Activate when DLD-827 is implemented
test.describe.skip('GET /api/me/requests/history — Forward Auth 전환 (DLD-827)', () => {
  /**
   * DLD-827: Forward Auth 기반 인증으로 전환
   *
   * 기존 loginAsAdmin(request) + withAuthHeader(auth.authentikUid) 2단계 호출을
   * forwardAuthHeaders(TEST_USERS.admin) 1단계 호출로 대체합니다.
   *
   * 검증 항목:
   * - Bearer 토큰 없이 Forward Auth 헤더만으로 history 조회 가능
   * - 응답 형식: { items: [...], hasMore: boolean, nextCursor: string | null }
   * - 쿼리 파라미터: limit, cursor 지원 확인
   */

  test('Forward Auth 헤더만으로 history를 조회하면 200과 올바른 형식을 반환한다 (happy path)', async ({
    request,
  }) => {
    // Act: Bearer 토큰 없이 Forward Auth 헤더만으로 history 조회 (1단계 호출)
    const response = await request.get('/api/me/requests/history', forwardAuthHeaders(TEST_USERS.admin));

    // Assert
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('hasMore');
    expect(body).toHaveProperty('nextCursor');
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.hasMore).toBe('boolean');
  });

  test('limit 쿼리 파라미터가 Forward Auth 헤더 인증에서도 동작한다 (happy path)', async ({
    request,
  }) => {
    // Act: limit 쿼리 파라미터와 함께 Forward Auth 헤더로 history 조회
    const response = await request.get(
      '/api/me/requests/history?limit=5',
      forwardAuthHeaders(TEST_USERS.admin)
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    // Assert: limit=5이면 items 배열 길이가 5 이하
    expect(body.items.length).toBeLessThanOrEqual(5);
  });

  test('Forward Auth 헤더 없이 history 조회하면 401을 반환한다 (error case)', async ({ request }) => {
    // Act: 인증 헤더 없이 history 조회 시도
    const response = await request.get('/api/me/requests/history');

    // Assert
    expect(response.status()).toBe(401);
  });
});

// TODO: Activate when DLD-827 is implemented
test.describe.skip('GET /api/me/requests/:id — Forward Auth 전환 (DLD-827)', () => {
  /**
   * DLD-827: Forward Auth 기반 인증으로 전환
   *
   * 기존 loginAsAdmin(request) + withAuthHeader(auth.authentikUid) 2단계 호출을
   * forwardAuthHeaders(TEST_USERS.admin) 1단계 호출로 대체합니다.
   *
   * 검증 항목:
   * - Bearer 토큰 없이 Forward Auth 헤더만으로 단건 요청 조회 가능
   * - expiresAt 자동 계산 및 EXPIRED 상태 자동 업데이트 동작 확인
   */

  test('Forward Auth 헤더만으로 존재하는 요청 단건을 조회하면 200을 반환한다 (happy path)', async ({
    request,
  }) => {
    // Arrange: 글로벌 시드 데이터에서 PENDING 요청의 ID 획득
    const listResponse = await request.get('/api/requests');
    const requests = await listResponse.json();

    const targetRequest = requests.find(
      (r: { externalId: string }) => r.externalId === SEED_PENDING_EXTERNAL_ID
    );
    expect(targetRequest).toBeDefined();

    // Act: Bearer 토큰 없이 Forward Auth 헤더만으로 단건 조회 (1단계 호출)
    const response = await request.get(
      `/api/me/requests/${targetRequest.id}`,
      forwardAuthHeaders(TEST_USERS.admin)
    );

    // Assert
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(targetRequest.id);
    expect(body.externalId).toBe(SEED_PENDING_EXTERNAL_ID);
  });

  test('Forward Auth 헤더로 조회한 요청에 expiresAt 필드가 포함된다 (happy path)', async ({
    request,
  }) => {
    // Arrange: 글로벌 시드 데이터에서 타임아웃 있는 PENDING 요청 획득
    const listResponse = await request.get('/api/requests');
    const requests = await listResponse.json();

    const targetRequest = requests.find(
      (r: { externalId: string }) => r.externalId === SEED_TIMEOUT_EXTERNAL_ID
    );

    if (!targetRequest) {
      test.skip();
      return;
    }

    // Act: Forward Auth 헤더로 단건 조회
    const response = await request.get(
      `/api/me/requests/${targetRequest.id}`,
      forwardAuthHeaders(TEST_USERS.admin)
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    // Assert: timeoutSeconds가 있는 요청은 expiresAt이 자동 계산되어 포함됨
    expect(body).toHaveProperty('expiresAt');
  });

  test('존재하지 않는 요청 ID로 조회하면 404를 반환한다 (error case)', async ({ request }) => {
    // Act: 존재하지 않는 ID로 조회
    const response = await request.get(
      '/api/me/requests/nonexistent-id-forward-auth-000',
      forwardAuthHeaders(TEST_USERS.admin)
    );

    // Assert
    expect(response.status()).toBe(404);
  });

  test('Forward Auth 헤더 없이 단건 조회하면 401을 반환한다 (error case)', async ({ request }) => {
    // Arrange: 임의의 ID (실제 존재하지 않아도 401이 먼저 반환되어야 함)
    const response = await request.get('/api/me/requests/some-request-id');

    // Assert
    expect(response.status()).toBe(401);
  });
});
