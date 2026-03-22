import { test, expect } from '@playwright/test';
import { loginAsAdmin, withAuthHeader, forwardAuthHeaders, TEST_USERS } from './helpers/auth';
import { cleanupTestData, createTestPrismaClient, createTestRequest } from './helpers/db';

/**
 * Request API E2E 테스트
 *
 * DLD-647: e2e 테스트 환경 구성
 * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
 *
 * 커버리지:
 * - POST /api/requests (외부 시스템의 승인 요청 생성)
 * - GET /api/requests (승인 요청 목록 조회, 공개)
 * - GET /api/requests/:id (단건 조회)
 * - PATCH /api/requests/:id/approve (승인)
 * - PATCH /api/requests/:id/reject (거절)
 *
 * TODO: DLD-647 구현 완료 후 test.describe.skip → test.describe 로 변경
 */

// API 키 헬퍼 (playwright.config.ts의 webServer.env.API_SECRET_KEY와 동일한 값 참조)
const E2E_API_KEY = process.env.API_SECRET_KEY ?? 'e2e-test-api-key-valid';

function withApiKeyHeader(): { headers: Record<string, string> } {
  return {
    headers: {
      'x-api-key': E2E_API_KEY,
    },
  };
}

// TODO: Activate when DLD-647 is implemented
test.describe('POST /api/requests (승인 요청 생성 - 공개 API)', () => {
  const createdExternalIds: string[] = [];

  test.afterEach(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
  });

  test('필수 필드로 새 Request를 생성하면 201을 반환한다 (happy path)', async ({ request }) => {
    const externalId = `e2e-create-${Date.now()}`;
    createdExternalIds.push(externalId);

    const response = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: '배포 승인 요청입니다.',
        requesterName: 'E2E Test Bot',
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body.externalId).toBe(externalId);
    expect(body.status).toBe('PENDING');
    expect(body.context).toBe('배포 승인 요청입니다.');
    expect(body.requesterName).toBe('E2E Test Bot');
  });

  test('timeoutSeconds 포함하여 Request 생성하면 해당 값이 저장된다 (happy path)', async ({
    request,
  }) => {
    const externalId = `e2e-timeout-${Date.now()}`;
    createdExternalIds.push(externalId);

    const response = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: '타임아웃이 있는 승인 요청',
        requesterName: 'E2E Bot',
        timeoutSeconds: 600,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.timeoutSeconds).toBe(600);
    expect(body.expiresAt).toBeTruthy();
  });

  test('동일한 externalId로 Request를 중복 생성하면 409를 반환한다 (edge case)', async ({
    request,
  }) => {
    const externalId = `e2e-dup-${Date.now()}`;
    createdExternalIds.push(externalId);

    // 첫 번째 생성
    await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: { externalId, context: '첫 번째', requesterName: 'Bot' },
    });

    // 중복 생성 시도
    const response = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: { externalId, context: '두 번째', requesterName: 'Bot' },
    });

    expect(response.status()).toBe(409);
  });

  test('externalId 없이 요청하면 400을 반환한다 (error case)', async ({ request }) => {
    const response = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        context: '필수 필드 누락',
        requesterName: 'Bot',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('context 없이 요청하면 400을 반환한다 (error case)', async ({ request }) => {
    const response = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId: `e2e-nocontext-${Date.now()}`,
        requesterName: 'Bot',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('requesterName 없이 요청하면 400을 반환한다 (error case)', async ({ request }) => {
    const response = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId: `e2e-noname-${Date.now()}`,
        context: '필수 필드 누락',
      },
    });

    expect(response.status()).toBe(400);
  });
});

// TODO: Activate when DLD-647 is implemented
test.describe('GET /api/requests (요청 목록 조회 - 공개 API)', () => {
  test('토큰 없이 요청 목록을 조회할 수 있다 (happy path)', async ({ request }) => {
    const response = await request.get('/api/requests');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('글로벌 시드 데이터의 PENDING 요청이 목록에 포함된다 (happy path)', async ({
    request,
  }) => {
    const response = await request.get('/api/requests');
    const body = await response.json();

    const pendingRequest = body.find(
      (r: { externalId: string }) => r.externalId === 'e2e-pending-001'
    );
    expect(pendingRequest).toBeDefined();
    expect(pendingRequest.status).toBe('PENDING');
  });

  test('status 쿼리로 PENDING 요청만 필터링할 수 있다 (happy path)', async ({ request }) => {
    const response = await request.get('/api/requests?status=PENDING');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);

    // 모든 항목이 PENDING 상태여야 함
    const allPending = body.every(
      (r: { status: string }) => r.status === 'PENDING'
    );
    expect(allPending).toBe(true);
  });

  test('status 쿼리로 APPROVED 요청만 필터링할 수 있다 (happy path)', async ({ request }) => {
    const response = await request.get('/api/requests?status=APPROVED');

    expect(response.status()).toBe(200);

    const body = await response.json();
    body.forEach((r: { status: string }) => {
      expect(r.status).toBe('APPROVED');
    });
  });

  test('잘못된 status 값으로 필터링하면 400을 반환한다 (edge case)', async ({ request }) => {
    const response = await request.get('/api/requests?status=INVALID_STATUS');

    expect(response.status()).toBe(400);
  });
});

// TODO: Activate when DLD-647 is implemented
test.describe('GET /api/requests/:id (단건 조회)', () => {
  test('존재하는 Request를 조회하면 200을 반환한다 (happy path)', async ({
    request,
  }) => {
    // 글로벌 시드 데이터에서 ID 획득
    const listResponse = await request.get('/api/requests');
    const requests = await listResponse.json();

    const targetRequest = requests.find(
      (r: { externalId: string }) => r.externalId === 'e2e-pending-001'
    );
    expect(targetRequest).toBeDefined();

    const response = await request.get(`/api/requests/${targetRequest.id}`, withApiKeyHeader());

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(targetRequest.id);
    expect(body.externalId).toBe('e2e-pending-001');
  });

  test('존재하지 않는 Request를 조회하면 404를 반환한다 (error case)', async ({
    request,
  }) => {
    const response = await request.get('/api/requests/99999', withApiKeyHeader());

    expect(response.status()).toBe(404);
  });
});

// TODO: Activate when DLD-647 is implemented
test.describe('PATCH /api/requests/:id/approve (승인)', () => {
  const createdExternalIds: string[] = [];

  test.afterEach(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
  });

  test('PENDING 상태의 Request를 승인하면 200을 반환한다 (happy path)', async ({
    request,
  }) => {
    // Arrange: PENDING Request 생성
    const externalId = `e2e-approve-${Date.now()}`;
    createdExternalIds.push(externalId);

    const createResponse = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: '승인 테스트용 요청',
        requesterName: 'E2E Bot',
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();

    // Forward Auth 헤더 획득
    const auth = await loginAsAdmin(request);

    // Act: 승인 요청
    const approveResponse = await request.patch(
      `/api/requests/${created.id}/approve`,
      withAuthHeader(auth.authentikUid)
    );

    // Assert
    expect(approveResponse.status()).toBe(200);
    const body = await approveResponse.json();
    expect(body.status).toBe('APPROVED');
    expect(body.processedAt).toBeTruthy();
  });

  test('이미 APPROVED 상태의 Request를 다시 승인하면 409를 반환한다 (edge case)', async ({
    request,
  }) => {
    // Arrange: PENDING Request 생성 후 승인
    const externalId = `e2e-approve-dup-${Date.now()}`;
    createdExternalIds.push(externalId);

    const createResponse = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: '중복 승인 테스트용 요청',
        requesterName: 'E2E Bot',
      },
    });
    const created = await createResponse.json();
    const auth = await loginAsAdmin(request);

    await request.patch(`/api/requests/${created.id}/approve`, withAuthHeader(auth.authentikUid));

    // Act: 다시 승인 시도
    const response = await request.patch(
      `/api/requests/${created.id}/approve`,
      withAuthHeader(auth.authentikUid)
    );

    // Assert
    expect(response.status()).toBe(409);
  });

  test('인증 없이 승인 요청하면 401을 반환한다 (error case)', async ({ request }) => {
    const listResponse = await request.get('/api/requests?status=PENDING');
    const list = await listResponse.json();
    const pendingRequest = list[0];

    if (!pendingRequest) {
      test.skip();
      return;
    }

    const response = await request.patch(`/api/requests/${pendingRequest.id}/approve`);

    expect(response.status()).toBe(401);
  });

  test('존재하지 않는 요청 ID로 승인하면 404를 반환한다 (error case)', async ({ request }) => {
    const { authentikUid } = await loginAsAdmin(request);

    const response = await request.patch(
      '/api/requests/nonexistent-id-000/approve',
      withAuthHeader(authentikUid)
    );

    expect(response.status()).toBe(404);
  });
});

// TODO: Activate when DLD-647 is implemented
test.describe('PATCH /api/requests/:id/reject (거절)', () => {
  const createdExternalIds: string[] = [];

  test.afterEach(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
  });

  test('PENDING 상태의 Request를 거절하면 200을 반환한다 (happy path)', async ({
    request,
  }) => {
    // Arrange: PENDING Request 생성
    const externalId = `e2e-reject-${Date.now()}`;
    createdExternalIds.push(externalId);

    const createResponse = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: '거절 테스트용 요청',
        requesterName: 'E2E Bot',
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();

    // Forward Auth 헤더 획득
    const auth = await loginAsAdmin(request);

    // Act: 거절 요청
    const rejectResponse = await request.patch(
      `/api/requests/${created.id}/reject`,
      withAuthHeader(auth.authentikUid)
    );

    // Assert
    expect(rejectResponse.status()).toBe(200);
    const body = await rejectResponse.json();
    expect(body.status).toBe('REJECTED');
    expect(body.processedAt).toBeTruthy();
  });

  test('이미 REJECTED 상태의 Request를 다시 거절하면 409를 반환한다 (edge case)', async ({
    request,
  }) => {
    // Arrange: PENDING Request 생성 후 거절
    const externalId = `e2e-reject-dup-${Date.now()}`;
    createdExternalIds.push(externalId);

    const createResponse = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: '중복 거절 테스트용 요청',
        requesterName: 'E2E Bot',
      },
    });
    const created = await createResponse.json();
    const auth = await loginAsAdmin(request);

    await request.patch(`/api/requests/${created.id}/reject`, withAuthHeader(auth.authentikUid));

    // Act: 다시 거절 시도
    const response = await request.patch(
      `/api/requests/${created.id}/reject`,
      withAuthHeader(auth.authentikUid)
    );

    // Assert
    expect(response.status()).toBe(409);
  });

  test('인증 없이 거절 요청하면 401을 반환한다 (error case)', async ({ request }) => {
    const listResponse = await request.get('/api/requests?status=PENDING');
    const list = await listResponse.json();
    const pendingRequest = list[0];

    if (!pendingRequest) {
      test.skip();
      return;
    }

    const response = await request.patch(`/api/requests/${pendingRequest.id}/reject`);

    expect(response.status()).toBe(401);
  });
});

// TODO: Activate when DLD-650 is implemented
test.describe('POST /api/requests (확인 요청 생성 - API Key 인증)', () => {
  /**
   * DLD-650: 작업 3-1: [확인 요청 생성] e2e 테스트 작성 (skipped)
   * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
   *
   * API Key 기반 인증으로 POST /api/requests를 호출하는 시나리오를 검증합니다.
   */

  const VALID_API_KEY = 'e2e-test-api-key-valid';
  const INVALID_API_KEY = 'invalid-api-key-does-not-exist';

  const createdExternalIds: string[] = [];

  test.afterEach(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
  });

  test('유효한 API Key로 확인 요청을 생성하면 201과 id를 반환한다 (happy path)', async ({
    request,
  }) => {
    const externalId = `e2e-apikey-create-${Date.now()}`;
    createdExternalIds.push(externalId);

    const response = await request.post('/api/requests', {
      headers: {
        'x-api-key': VALID_API_KEY,
      },
      data: {
        externalId,
        context: 'API Key 인증 배포 승인 요청입니다.',
        requesterName: 'E2E API Key Bot',
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('string');
  });

  test('context와 timeoutSeconds를 포함하여 요청을 생성하면 해당 값이 올바르게 저장된다 (happy path)', async ({
    request,
  }) => {
    const externalId = `e2e-apikey-timeout-${Date.now()}`;
    createdExternalIds.push(externalId);

    const response = await request.post('/api/requests', {
      headers: {
        'x-api-key': VALID_API_KEY,
      },
      data: {
        externalId,
        context: '맥락 정보가 포함된 승인 요청입니다.',
        requesterName: 'E2E API Key Bot',
        timeoutSeconds: 300,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body.context).toBe('맥락 정보가 포함된 승인 요청입니다.');
    expect(body.timeoutSeconds).toBe(300);
  });

  test('timeoutSeconds 없이 요청을 생성하면 정상 생성되고 timeoutSeconds가 null이다 (edge case)', async ({
    request,
  }) => {
    const externalId = `e2e-apikey-notimeout-${Date.now()}`;
    createdExternalIds.push(externalId);

    const response = await request.post('/api/requests', {
      headers: {
        'x-api-key': VALID_API_KEY,
      },
      data: {
        externalId,
        context: '타임아웃 없는 승인 요청입니다.',
        requesterName: 'E2E API Key Bot',
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body.timeoutSeconds).toBeNull();
  });

  test('존재하지 않는 userId를 지정하면 에러를 반환한다 (error case)', async ({ request }) => {
    const externalId = `e2e-apikey-nouser-${Date.now()}`;

    const response = await request.post('/api/requests', {
      headers: {
        'x-api-key': VALID_API_KEY,
      },
      data: {
        externalId,
        context: '존재하지 않는 사용자에게 보내는 승인 요청입니다.',
        requesterName: 'E2E API Key Bot',
        userId: 'nonexistent-user-id-000',
      },
    });

    // 존재하지 않는 userId 지정 시 4xx 에러(404 또는 400)를 반환해야 합니다
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);

    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('잘못된 API Key로 요청하면 401을 반환한다 (error case)', async ({ request }) => {
    const externalId = `e2e-apikey-invalid-${Date.now()}`;

    const response = await request.post('/api/requests', {
      headers: {
        'x-api-key': INVALID_API_KEY,
      },
      data: {
        externalId,
        context: '잘못된 API Key로 보내는 승인 요청입니다.',
        requesterName: 'E2E API Key Bot',
      },
    });

    expect(response.status()).toBe(401);
  });
});

test.describe('GET /api/requests/:id (요청 상태 polling)', () => {
  /**
   * DLD-653: 작업 4-2: [요청 상태 polling] 구현 및 e2e 테스트 활성화
   * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
   *
   * GET /api/requests/:id (API Key 인증)로 요청 상태를 polling하는
   * 시나리오를 검증합니다.
   */

  const createdExternalIds: string[] = [];

  test.afterEach(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
  });

  test('대기 중인 요청을 polling하면 status가 PENDING이다 (happy path)', async ({ request }) => {
    // 글로벌 시드 데이터에서 PENDING 요청의 ID 획득
    const listResponse = await request.get('/api/requests');
    const requests = await listResponse.json();

    const targetRequest = requests.find(
      (r: { externalId: string }) => r.externalId === 'e2e-pending-001'
    );
    expect(targetRequest).toBeDefined();

    const response = await request.get(`/api/requests/${targetRequest.id}`, withApiKeyHeader());

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('PENDING');
  });

  test('승인된 요청을 polling하면 status가 APPROVED이다 (happy path)', async ({ request }) => {
    // 글로벌 시드 데이터에서 APPROVED 요청의 ID 획득
    const listResponse = await request.get('/api/requests');
    const requests = await listResponse.json();

    const targetRequest = requests.find(
      (r: { externalId: string }) => r.externalId === 'e2e-approved-001'
    );
    expect(targetRequest).toBeDefined();

    const response = await request.get(`/api/requests/${targetRequest.id}`, withApiKeyHeader());

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('APPROVED');
  });

  test('거절된 요청을 polling하면 status가 REJECTED이다 (happy path)', async ({ request }) => {
    // 글로벌 시드 데이터에서 REJECTED 요청의 ID 획득
    const listResponse = await request.get('/api/requests');
    const requests = await listResponse.json();

    const targetRequest = requests.find(
      (r: { externalId: string }) => r.externalId === 'e2e-rejected-001'
    );
    expect(targetRequest).toBeDefined();

    const response = await request.get(`/api/requests/${targetRequest.id}`, withApiKeyHeader());

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('REJECTED');
  });

  test('만료된 요청을 polling하면 status가 EXPIRED이다 (edge case)', async ({ request }) => {
    // EXPIRED 시드 데이터가 없으므로 DB에 직접 EXPIRED 상태로 생성
    const externalId = `e2e-expired-${Date.now()}`;
    createdExternalIds.push(externalId);

    const created = await createTestRequest({
      externalId,
      context: '만료 상태 polling 테스트용 요청',
      requesterName: 'E2E Bot',
      status: 'EXPIRED',
    });

    const response = await request.get(`/api/requests/${created.id}`, withApiKeyHeader());

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('EXPIRED');
  });

  test('존재하지 않는 ID로 polling하면 404를 반환한다 (error case)', async ({ request }) => {
    const response = await request.get('/api/requests/nonexistent-id-000', withApiKeyHeader());

    expect(response.status()).toBe(404);

    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});

test.describe('PATCH /api/requests/:id/approve — Forward Auth 전환 (DLD-827)', () => {
  /**
   * DLD-827: Forward Auth 기반 인증으로 전환
   *
   * 기존 loginAsAdmin(request) + withAuthHeader(auth.authentikUid) 2단계 호출을
   * forwardAuthHeaders(TEST_USERS.admin) 1단계 호출로 대체합니다.
   *
   * 검증 항목:
   * - Forward Auth 헤더만으로 승인 처리가 성공함
   * - 응답 body의 processedById에 인증된 사용자의 내부 DB ID가 기록됨
   */

  const createdExternalIds: string[] = [];

  test.afterEach(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
  });

  test('Forward Auth 헤더로 PENDING 요청을 승인하면 200과 APPROVED 상태를 반환한다 (happy path)', async ({
    request,
  }) => {
    // Arrange: PENDING Request 생성
    const externalId = `e2e-fa-approve-${Date.now()}`;
    createdExternalIds.push(externalId);

    const createResponse = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: 'Forward Auth 승인 전환 테스트용 요청',
        requesterName: 'E2E Bot',
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();

    // Act: Forward Auth 헤더로 승인 (1단계 호출)
    const approveResponse = await request.patch(
      `/api/requests/${created.id}/approve`,
      forwardAuthHeaders(TEST_USERS.admin)
    );

    // Assert
    expect(approveResponse.status()).toBe(200);
    const body = await approveResponse.json();
    expect(body.status).toBe('APPROVED');
    expect(body.processedAt).toBeTruthy();
  });

  test('승인 후 processedById에 Forward Auth 헤더의 사용자 ID가 기록된다 (happy path)', async ({
    request,
  }) => {
    // Arrange: PENDING Request 생성
    const externalId = `e2e-fa-approve-uid-${Date.now()}`;
    createdExternalIds.push(externalId);

    const createResponse = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: 'processedById 검증용 요청',
        requesterName: 'E2E Bot',
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();

    // Act: Forward Auth 헤더로 승인
    const approveResponse = await request.patch(
      `/api/requests/${created.id}/approve`,
      forwardAuthHeaders(TEST_USERS.admin)
    );

    expect(approveResponse.status()).toBe(200);
    const body = await approveResponse.json();

    // Assert: processedById가 null이 아닌 실제 사용자 ID임을 검증
    expect(body.processedById).toBeTruthy();
    expect(typeof body.processedById).toBe('string');

    // Assert: Forward Auth 헤더의 authentikUid로 조회한 사용자의 내부 ID와 일치해야 함
    const prisma = await createTestPrismaClient();
    try {
      const user = await prisma.user.findUnique({
        where: { authentikUid: TEST_USERS.admin.authentikUid },
        select: { id: true },
      });
      expect(user).not.toBeNull();
      expect(body.processedById).toBe(user?.id);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Bearer 토큰 없이 Forward Auth 헤더만으로 승인이 처리된다 (edge case)', async ({
    request,
  }) => {
    // Arrange: PENDING Request 생성
    const externalId = `e2e-fa-approve-nobearer-${Date.now()}`;
    createdExternalIds.push(externalId);

    const createResponse = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: 'Bearer 토큰 미사용 승인 테스트용 요청',
        requesterName: 'E2E Bot',
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();

    // Act: Authorization 헤더 없이 Forward Auth 헤더만으로 승인
    // forwardAuthHeaders는 x-authentik-* 헤더만 포함하며 Authorization 헤더를 포함하지 않음
    const approveResponse = await request.patch(
      `/api/requests/${created.id}/approve`,
      forwardAuthHeaders(TEST_USERS.admin)
    );

    // Assert: Bearer 토큰 없이도 Forward Auth 헤더만으로 승인 성공
    expect(approveResponse.status()).toBe(200);
    const body = await approveResponse.json();
    expect(body.status).toBe('APPROVED');
  });

  test('Forward Auth 헤더 없이 승인 요청하면 401을 반환한다 (error case)', async ({ request }) => {
    const listResponse = await request.get('/api/requests?status=PENDING');
    const list = await listResponse.json();
    const pendingRequest = list[0];

    if (!pendingRequest) {
      test.skip();
      return;
    }

    // Act: 인증 헤더 없이 승인 시도
    const response = await request.patch(`/api/requests/${pendingRequest.id}/approve`);

    // Assert
    expect(response.status()).toBe(401);
  });
});

test.describe('PATCH /api/requests/:id/reject — Forward Auth 전환 (DLD-827)', () => {
  /**
   * DLD-827: Forward Auth 기반 인증으로 전환
   *
   * 기존 loginAsAdmin(request) + withAuthHeader(auth.authentikUid) 2단계 호출을
   * forwardAuthHeaders(TEST_USERS.admin) 1단계 호출로 대체합니다.
   *
   * 검증 항목:
   * - Forward Auth 헤더만으로 거절 처리가 성공함
   * - 응답 body의 processedById에 인증된 사용자의 내부 DB ID가 기록됨
   */

  const createdExternalIds: string[] = [];

  test.afterEach(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
  });

  test('Forward Auth 헤더로 PENDING 요청을 거절하면 200과 REJECTED 상태를 반환한다 (happy path)', async ({
    request,
  }) => {
    // Arrange: PENDING Request 생성
    const externalId = `e2e-fa-reject-${Date.now()}`;
    createdExternalIds.push(externalId);

    const createResponse = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: 'Forward Auth 거절 전환 테스트용 요청',
        requesterName: 'E2E Bot',
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();

    // Act: Forward Auth 헤더로 거절 (1단계 호출)
    const rejectResponse = await request.patch(
      `/api/requests/${created.id}/reject`,
      forwardAuthHeaders(TEST_USERS.admin)
    );

    // Assert
    expect(rejectResponse.status()).toBe(200);
    const body = await rejectResponse.json();
    expect(body.status).toBe('REJECTED');
    expect(body.processedAt).toBeTruthy();
  });

  test('거절 후 processedById에 Forward Auth 헤더의 사용자 ID가 기록된다 (happy path)', async ({
    request,
  }) => {
    // Arrange: PENDING Request 생성
    const externalId = `e2e-fa-reject-uid-${Date.now()}`;
    createdExternalIds.push(externalId);

    const createResponse = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: 'processedById 거절 검증용 요청',
        requesterName: 'E2E Bot',
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();

    // Act: Forward Auth 헤더로 거절
    const rejectResponse = await request.patch(
      `/api/requests/${created.id}/reject`,
      forwardAuthHeaders(TEST_USERS.admin)
    );

    expect(rejectResponse.status()).toBe(200);
    const body = await rejectResponse.json();

    // Assert: processedById가 null이 아닌 실제 사용자 ID임을 검증
    expect(body.processedById).toBeTruthy();
    expect(typeof body.processedById).toBe('string');

    // Assert: Forward Auth 헤더의 authentikUid로 조회한 사용자의 내부 ID와 일치해야 함
    const prisma = await createTestPrismaClient();
    try {
      const user = await prisma.user.findUnique({
        where: { authentikUid: TEST_USERS.admin.authentikUid },
        select: { id: true },
      });
      expect(user).not.toBeNull();
      expect(body.processedById).toBe(user?.id);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Forward Auth 헤더 없이 거절 요청하면 401을 반환한다 (error case)', async ({ request }) => {
    const listResponse = await request.get('/api/requests?status=PENDING');
    const list = await listResponse.json();
    const pendingRequest = list[0];

    if (!pendingRequest) {
      test.skip();
      return;
    }

    // Act: 인증 헤더 없이 거절 시도
    const response = await request.patch(`/api/requests/${pendingRequest.id}/reject`);

    // Assert
    expect(response.status()).toBe(401);
  });
});
