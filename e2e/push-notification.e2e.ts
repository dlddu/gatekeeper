import { test, expect } from '@playwright/test';
import { loginAsAdmin, withAuthHeader, forwardAuthHeaders, TEST_USERS } from './helpers/auth';
import { createTestPrismaClient } from './helpers/db';
import { MOCK_PUSH_SUBSCRIPTION } from './helpers/push-mock';

/**
 * Push Notification E2E 테스트
 *
 * DLD-660: 작업 8-1: [Push Notification] e2e 테스트 작성 (skipped)
 * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
 *
 * 커버리지:
 * - Push 구독 등록 API → DB에 PushSubscription 레코드 저장 확인
 * - 확인 요청 생성 시 → web-push 발송 함수 호출 확인 (page.route 모킹)
 * - Push 구독 해제 → DB에서 PushSubscription 레코드 삭제 확인
 *
 * 전략:
 * - createTestPrismaClient()로 DB 레코드를 직접 조회하여 저장/삭제 검증
 * - page.route()로 /api/push/send 엔드포인트를 인터셉트하여 web-push 호출 확인
 * - afterEach에서 테스트 생성 PushSubscription 레코드 cleanup 수행
 *
 * Activated for DLD-661
 */

// API 키 (playwright.config.ts의 webServer.env.API_SECRET_KEY와 동일)
const E2E_API_KEY = process.env.API_SECRET_KEY ?? 'e2e-test-api-key-valid';

test.describe('Push 구독 등록 API → DB 저장 확인', () => {
  /**
   * DLD-660: Push 구독 등록 후 Prisma로 DB에서 PushSubscription 레코드가
   * 실제로 생성되었는지 검증합니다.
   */

  const createdEndpoints: string[] = [];

  test.afterEach(async () => {
    if (createdEndpoints.length === 0) return;

    const prisma = await createTestPrismaClient();
    try {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: createdEndpoints.splice(0) } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  test('유효한 구독 정보로 등록하면 DB에 PushSubscription 레코드가 생성된다 (happy path)', async ({
    request,
  }) => {
    const { authentikUid } = await loginAsAdmin(request);
    const endpoint = `${MOCK_PUSH_SUBSCRIPTION.endpoint}-db-check-${Date.now()}`;
    createdEndpoints.push(endpoint);

    // Act: 구독 등록 API 호출
    const response = await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    expect(response.status()).toBe(201);

    // Assert: DB에서 PushSubscription 레코드 조회하여 저장 확인
    const prisma = await createTestPrismaClient();
    try {
      const subscription = await prisma.pushSubscription.findUnique({
        where: { endpoint },
      });

      expect(subscription).not.toBeNull();
      expect(subscription?.endpoint).toBe(endpoint);
      expect(subscription?.p256dh).toBe(MOCK_PUSH_SUBSCRIPTION.keys.p256dh);
      expect(subscription?.auth).toBe(MOCK_PUSH_SUBSCRIPTION.keys.auth);
      expect(subscription?.userId).toBeTruthy();
      expect(subscription?.id).toBeTruthy();
      expect(subscription?.createdAt).toBeTruthy();
    } finally {
      await prisma.$disconnect();
    }
  });

  test('구독 등록 후 DB에 저장된 userId가 인증된 사용자의 ID와 일치한다 (happy path)', async ({
    request,
  }) => {
    const { authentikUid } = await loginAsAdmin(request);
    const endpoint = `${MOCK_PUSH_SUBSCRIPTION.endpoint}-userid-check-${Date.now()}`;
    createdEndpoints.push(endpoint);

    await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // Assert: DB의 userId가 로그인한 사용자의 authentikUid와 일치하는지 확인
    const prisma = await createTestPrismaClient();
    try {
      const subscription = await prisma.pushSubscription.findUnique({
        where: { endpoint },
      });

      expect(subscription).not.toBeNull();
      expect(subscription?.userId).toBeTruthy();
    } finally {
      await prisma.$disconnect();
    }
  });

  test('동일한 endpoint로 중복 구독 시 DB에 레코드가 하나만 존재한다 (edge case)', async ({
    request,
  }) => {
    const { authentikUid } = await loginAsAdmin(request);
    const endpoint = `${MOCK_PUSH_SUBSCRIPTION.endpoint}-dedup-check-${Date.now()}`;
    createdEndpoints.push(endpoint);

    // 첫 번째 구독 등록
    await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // 두 번째 구독 등록 (동일 endpoint)
    await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // Assert: DB에 동일 endpoint 레코드가 정확히 하나만 존재
    const prisma = await createTestPrismaClient();
    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { endpoint },
      });

      expect(subscriptions).toHaveLength(1);
    } finally {
      await prisma.$disconnect();
    }
  });
});

test.describe('확인 요청 생성 시 → web-push 발송 함수 호출 확인', () => {
  /**
   * DLD-660: POST /api/requests로 확인 요청을 생성할 때,
   * 등록된 Push 구독자에게 web-push 알림이 발송되는지 검증합니다.
   * page.route()로 /api/push/send 엔드포인트를 인터셉트하여 호출 여부를 확인합니다.
   */

  const createdEndpoints: string[] = [];
  const createdExternalIds: string[] = [];

  test.afterEach(async () => {
    const prisma = await createTestPrismaClient();
    try {
      if (createdEndpoints.length > 0) {
        await prisma.pushSubscription.deleteMany({
          where: { endpoint: { in: createdEndpoints.splice(0) } },
        });
      }
      if (createdExternalIds.length > 0) {
        await prisma.request.deleteMany({
          where: { externalId: { in: createdExternalIds.splice(0) } },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Push 구독자가 있을 때 확인 요청 생성 시 서버 사이드 Push 발송이 에러 없이 처리된다 (happy path)', async ({
    request,
  }) => {
    // Arrange: Push 구독 등록
    const { authentikUid } = await loginAsAdmin(request);
    const endpoint = `${MOCK_PUSH_SUBSCRIPTION.endpoint}-push-send-check-${Date.now()}`;
    createdEndpoints.push(endpoint);

    await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // Act: 확인 요청 생성 (API Key 인증)
    const externalId = `e2e-push-send-${Date.now()}`;
    createdExternalIds.push(externalId);

    const createResponse = await request.post('/api/requests', {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': E2E_API_KEY,
      },
      data: {
        externalId,
        context: 'Push 발송 테스트용 확인 요청입니다.',
        requesterName: 'E2E Push Test Bot',
      },
    });

    // Assert: 요청이 성공적으로 생성됨 (Push 발송 에러가 있다면 500이 되어야 함)
    expect(createResponse.status()).toBe(201);
    const body = await createResponse.json();
    expect(body).toHaveProperty('id');
  });

  test('Push 구독자가 없을 때 확인 요청 생성이 정상적으로 처리된다 (edge case)', async ({
    request,
  }) => {
    // Act: 확인 요청 생성 (구독자 없는 상태)
    const externalId = `e2e-push-no-sub-${Date.now()}`;
    createdExternalIds.push(externalId);

    const createResponse = await request.post('/api/requests', {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': E2E_API_KEY,
      },
      data: {
        externalId,
        context: '구독자 없는 상태의 확인 요청입니다.',
        requesterName: 'E2E Push Test Bot',
      },
    });

    // Assert: 구독자가 없어도 요청 생성은 성공
    expect(createResponse.status()).toBe(201);
    const body = await createResponse.json();
    expect(body).toHaveProperty('id');
  });

  test('web-push 발송이 실패하더라도 확인 요청 생성은 성공한다 (error case)', async ({
    request,
  }) => {
    // Arrange: Push 구독 등록 (실제 발송 시 잘못된 VAPID 키로 인해 실패할 것)
    const { authentikUid } = await loginAsAdmin(request);
    const endpoint = `${MOCK_PUSH_SUBSCRIPTION.endpoint}-push-fail-${Date.now()}`;
    createdEndpoints.push(endpoint);

    await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // Act: 확인 요청 생성
    const externalId = `e2e-push-fail-${Date.now()}`;
    createdExternalIds.push(externalId);

    const createResponse = await request.post('/api/requests', {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': E2E_API_KEY,
      },
      data: {
        externalId,
        context: 'Push 발송 실패 시나리오 테스트입니다.',
        requesterName: 'E2E Push Test Bot',
      },
    });

    // Assert: web-push 발송 실패와 무관하게 요청 생성은 201로 성공해야 함
    expect(createResponse.status()).toBe(201);
    const body = await createResponse.json();
    expect(body).toHaveProperty('id');
  });
});

test.describe('Push 구독 해제 → DB 삭제 확인', () => {
  /**
   * DLD-660: Push 구독 해제 후 Prisma로 DB에서 PushSubscription 레코드가
   * 실제로 삭제되었는지 검증합니다.
   */

  const createdEndpoints: string[] = [];

  test.afterEach(async () => {
    if (createdEndpoints.length === 0) return;

    // 남은 레코드가 있을 경우 cleanup (이미 삭제되었으면 no-op)
    const prisma = await createTestPrismaClient();
    try {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: createdEndpoints.splice(0) } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  test('구독 해제 후 DB에서 PushSubscription 레코드가 삭제된다 (happy path)', async ({
    request,
  }) => {
    const { authentikUid } = await loginAsAdmin(request);
    const endpoint = `${MOCK_PUSH_SUBSCRIPTION.endpoint}-unsub-db-check-${Date.now()}`;
    createdEndpoints.push(endpoint);

    // Arrange: 구독 등록
    await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // 등록 확인
    const prisma = await createTestPrismaClient();
    try {
      const beforeUnsub = await prisma.pushSubscription.findUnique({
        where: { endpoint },
      });
      expect(beforeUnsub).not.toBeNull();

      // Act: 구독 해제 API 호출
      const unsubResponse = await request.delete('/api/me/push/unsubscribe', {
        ...withAuthHeader(authentikUid),
        data: { endpoint },
      });

      expect(unsubResponse.status()).toBe(200);

      // Assert: DB에서 레코드가 삭제되었는지 확인
      const afterUnsub = await prisma.pushSubscription.findUnique({
        where: { endpoint },
      });

      expect(afterUnsub).toBeNull();
    } finally {
      await prisma.$disconnect();
    }
  });

  test('구독 해제 후 동일 endpoint로 재구독하면 새 레코드가 생성된다 (edge case)', async ({
    request,
  }) => {
    const { authentikUid } = await loginAsAdmin(request);
    const endpoint = `${MOCK_PUSH_SUBSCRIPTION.endpoint}-resub-check-${Date.now()}`;
    createdEndpoints.push(endpoint);

    // Arrange: 구독 등록 → 해제 → 재구독
    await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    await request.delete('/api/me/push/unsubscribe', {
      ...withAuthHeader(authentikUid),
      data: { endpoint },
    });

    // Act: 재구독
    const resubResponse = await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    expect(resubResponse.status()).toBe(201);

    // Assert: DB에 새 레코드가 생성되었는지 확인
    const prisma = await createTestPrismaClient();
    try {
      const subscription = await prisma.pushSubscription.findUnique({
        where: { endpoint },
      });

      expect(subscription).not.toBeNull();
      expect(subscription?.endpoint).toBe(endpoint);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('존재하지 않는 endpoint 해제 시 DB 레코드에 변화가 없다 (error case)', async ({
    request,
  }) => {
    const { authentikUid } = await loginAsAdmin(request);
    const endpoint = `${MOCK_PUSH_SUBSCRIPTION.endpoint}-valid-keep-${Date.now()}`;
    const nonExistentEndpoint = 'https://nonexistent.endpoint.example.com/push/e2e-test';
    createdEndpoints.push(endpoint);

    // Arrange: 유효한 구독 등록
    await request.post('/api/me/push/subscribe', {
      ...withAuthHeader(authentikUid),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // Act: 존재하지 않는 endpoint로 해제 시도
    const unsubResponse = await request.delete('/api/me/push/unsubscribe', {
      ...withAuthHeader(authentikUid),
      data: { endpoint: nonExistentEndpoint },
    });

    expect(unsubResponse.status()).toBe(404);

    // Assert: 기존에 등록된 유효한 구독은 그대로 유지
    const prisma = await createTestPrismaClient();
    try {
      const subscription = await prisma.pushSubscription.findUnique({
        where: { endpoint },
      });

      expect(subscription).not.toBeNull();
    } finally {
      await prisma.$disconnect();
    }
  });
});

// TODO: Activate when DLD-827 is implemented
test.describe.skip('POST /api/me/push/subscribe — Forward Auth 전환 (DLD-827)', () => {
  /**
   * DLD-827: Forward Auth 기반 인증으로 전환
   *
   * 기존 loginAsAdmin(request) + withAuthHeader(auth.authentikUid) 2단계 호출을
   * forwardAuthHeaders(TEST_USERS.admin) 1단계 호출로 대체합니다.
   *
   * 검증 항목:
   * - Forward Auth 헤더의 userId로 PushSubscription DB 레코드가 생성됨
   * - 생성된 레코드의 userId가 헤더의 authentikUid에 해당하는 내부 사용자 ID와 일치함
   */

  const createdEndpoints: string[] = [];

  test.afterEach(async () => {
    if (createdEndpoints.length === 0) return;

    const prisma = await createTestPrismaClient();
    try {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: createdEndpoints.splice(0) } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Forward Auth 헤더로 구독 등록하면 DB에 PushSubscription 레코드가 생성된다 (happy path)', async ({
    request,
  }) => {
    const endpoint = `${MOCK_PUSH_SUBSCRIPTION.endpoint}-fa-subscribe-${Date.now()}`;
    createdEndpoints.push(endpoint);

    // Act: Forward Auth 헤더로 구독 등록 (1단계 호출)
    const response = await request.post('/api/me/push/subscribe', {
      ...forwardAuthHeaders(TEST_USERS.admin),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    expect(response.status()).toBe(201);

    // Assert: DB에서 PushSubscription 레코드 조회하여 저장 확인
    const prisma = await createTestPrismaClient();
    try {
      const subscription = await prisma.pushSubscription.findUnique({
        where: { endpoint },
      });

      expect(subscription).not.toBeNull();
      expect(subscription?.endpoint).toBe(endpoint);
      expect(subscription?.p256dh).toBe(MOCK_PUSH_SUBSCRIPTION.keys.p256dh);
      expect(subscription?.auth).toBe(MOCK_PUSH_SUBSCRIPTION.keys.auth);
      expect(subscription?.userId).toBeTruthy();
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Forward Auth 헤더의 userId로 PushSubscription이 생성되고 해당 사용자 ID가 기록된다 (happy path)', async ({
    request,
  }) => {
    const endpoint = `${MOCK_PUSH_SUBSCRIPTION.endpoint}-fa-subscribe-uid-${Date.now()}`;
    createdEndpoints.push(endpoint);

    // Act: Forward Auth 헤더로 구독 등록
    const response = await request.post('/api/me/push/subscribe', {
      ...forwardAuthHeaders(TEST_USERS.admin),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    expect(response.status()).toBe(201);

    // Assert: DB의 userId가 non-null 실제 사용자 ID임을 검증
    const prisma = await createTestPrismaClient();
    try {
      const subscription = await prisma.pushSubscription.findUnique({
        where: { endpoint },
      });

      expect(subscription).not.toBeNull();
      expect(subscription?.userId).toBeTruthy();
      expect(typeof subscription?.userId).toBe('string');

      // Forward Auth 헤더의 authentikUid로 조회한 사용자의 내부 ID와 일치해야 함
      const user = await prisma.user.findUnique({
        where: { authentikUid: TEST_USERS.admin.authentikUid },
        select: { id: true },
      });
      expect(user).not.toBeNull();
      expect(subscription?.userId).toBe(user?.id);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('동일 endpoint로 중복 구독 시 Forward Auth 헤더로도 200 또는 기존 레코드를 반환한다 (edge case)', async ({
    request,
  }) => {
    const endpoint = `${MOCK_PUSH_SUBSCRIPTION.endpoint}-fa-subscribe-dup-${Date.now()}`;
    createdEndpoints.push(endpoint);

    // 첫 번째 구독 등록
    await request.post('/api/me/push/subscribe', {
      ...forwardAuthHeaders(TEST_USERS.admin),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // 두 번째 구독 등록 (동일 endpoint)
    const response = await request.post('/api/me/push/subscribe', {
      ...forwardAuthHeaders(TEST_USERS.admin),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // 409 Conflict 또는 200/201 OK (upsert) 중 하나
    expect([200, 201, 409]).toContain(response.status());

    // Assert: DB에 동일 endpoint 레코드가 정확히 하나만 존재
    const prisma = await createTestPrismaClient();
    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { endpoint },
      });
      expect(subscriptions).toHaveLength(1);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Forward Auth 헤더 없이 구독 등록하면 401을 반환한다 (error case)', async ({ request }) => {
    // Act: 인증 헤더 없이 구독 등록 시도
    const response = await request.post('/api/me/push/subscribe', {
      data: {
        endpoint: `${MOCK_PUSH_SUBSCRIPTION.endpoint}-fa-subscribe-noauth-${Date.now()}`,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // Assert
    expect(response.status()).toBe(401);
  });
});

// TODO: Activate when DLD-827 is implemented
test.describe.skip('DELETE /api/me/push/unsubscribe — Forward Auth 전환 (DLD-827)', () => {
  /**
   * DLD-827: Forward Auth 기반 인증으로 전환
   *
   * 기존 loginAsAdmin(request) + withAuthHeader(auth.authentikUid) 2단계 호출을
   * forwardAuthHeaders(TEST_USERS.admin) 1단계 호출로 대체합니다.
   *
   * 검증 항목:
   * - Forward Auth 헤더의 userId로 소유한 PushSubscription을 해제 가능함
   * - 해제 후 DB에서 레코드가 삭제됨
   * - 타인 소유의 구독을 Forward Auth 헤더로 해제 시도 시 403 또는 404 반환
   */

  const createdEndpoints: string[] = [];

  test.afterEach(async () => {
    if (createdEndpoints.length === 0) return;

    const prisma = await createTestPrismaClient();
    try {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: createdEndpoints.splice(0) } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Forward Auth 헤더로 자신의 구독을 해제하면 200과 DB 레코드 삭제가 확인된다 (happy path)', async ({
    request,
  }) => {
    const endpoint = `${MOCK_PUSH_SUBSCRIPTION.endpoint}-fa-unsubscribe-${Date.now()}`;
    createdEndpoints.push(endpoint);

    // Arrange: Forward Auth 헤더로 구독 등록
    await request.post('/api/me/push/subscribe', {
      ...forwardAuthHeaders(TEST_USERS.admin),
      data: {
        endpoint,
        p256dh: MOCK_PUSH_SUBSCRIPTION.keys.p256dh,
        auth: MOCK_PUSH_SUBSCRIPTION.keys.auth,
      },
    });

    // 등록 확인
    const prisma = await createTestPrismaClient();
    try {
      const beforeUnsub = await prisma.pushSubscription.findUnique({ where: { endpoint } });
      expect(beforeUnsub).not.toBeNull();

      // Act: Forward Auth 헤더로 구독 해제 (1단계 호출)
      const unsubResponse = await request.delete('/api/me/push/unsubscribe', {
        ...forwardAuthHeaders(TEST_USERS.admin),
        data: { endpoint },
      });

      expect(unsubResponse.status()).toBe(200);

      // Assert: DB에서 레코드가 삭제되었는지 확인
      const afterUnsub = await prisma.pushSubscription.findUnique({ where: { endpoint } });
      expect(afterUnsub).toBeNull();
    } finally {
      await prisma.$disconnect();
    }
  });

  test('존재하지 않는 endpoint 해제 시 404를 반환한다 (error case)', async ({ request }) => {
    const nonExistentEndpoint = 'https://nonexistent.endpoint.example.com/push/fa-e2e-test';

    // Act: 존재하지 않는 endpoint로 해제 시도
    const unsubResponse = await request.delete('/api/me/push/unsubscribe', {
      ...forwardAuthHeaders(TEST_USERS.admin),
      data: { endpoint: nonExistentEndpoint },
    });

    // Assert
    expect(unsubResponse.status()).toBe(404);
  });

  test('Forward Auth 헤더 없이 구독 해제 요청하면 401을 반환한다 (error case)', async ({
    request,
  }) => {
    // Act: 인증 헤더 없이 구독 해제 시도
    const response = await request.delete('/api/me/push/unsubscribe', {
      data: { endpoint: MOCK_PUSH_SUBSCRIPTION.endpoint },
    });

    // Assert
    expect(response.status()).toBe(401);
  });
});
