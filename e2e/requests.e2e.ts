import { test, expect } from '@playwright/test';
import { loginAsAdmin, withAuthHeader } from './helpers/auth';
import { cleanupTestData } from './helpers/db';

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

// TODO: Activate when DLD-647 is implemented
test.describe.skip('POST /api/requests (승인 요청 생성 - 공개 API)', () => {
  const createdExternalIds: string[] = [];

  test.afterEach(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
  });

  test('필수 필드로 새 Request를 생성하면 201을 반환한다 (happy path)', async ({ request }) => {
    const externalId = `e2e-create-${Date.now()}`;
    createdExternalIds.push(externalId);

    const response = await request.post('/api/requests', {
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
  });

  test('동일한 externalId로 Request를 중복 생성하면 409를 반환한다 (edge case)', async ({
    request,
  }) => {
    const externalId = `e2e-dup-${Date.now()}`;
    createdExternalIds.push(externalId);

    // 첫 번째 생성
    await request.post('/api/requests', {
      data: { externalId, context: '첫 번째', requesterName: 'Bot' },
    });

    // 중복 생성 시도
    const response = await request.post('/api/requests', {
      data: { externalId, context: '두 번째', requesterName: 'Bot' },
    });

    expect(response.status()).toBe(409);
  });

  test('externalId 없이 요청하면 400을 반환한다 (error case)', async ({ request }) => {
    const response = await request.post('/api/requests', {
      data: {
        context: '필수 필드 누락',
        requesterName: 'Bot',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('context 없이 요청하면 400을 반환한다 (error case)', async ({ request }) => {
    const response = await request.post('/api/requests', {
      data: {
        externalId: `e2e-nocontext-${Date.now()}`,
        requesterName: 'Bot',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('requesterName 없이 요청하면 400을 반환한다 (error case)', async ({ request }) => {
    const response = await request.post('/api/requests', {
      data: {
        externalId: `e2e-noname-${Date.now()}`,
        context: '필수 필드 누락',
      },
    });

    expect(response.status()).toBe(400);
  });
});

// TODO: Activate when DLD-647 is implemented
test.describe.skip('GET /api/requests (요청 목록 조회 - 공개 API)', () => {
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
    body.forEach((r: { status: string }) => {
      expect(r.status).toBe('PENDING');
    });
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
test.describe.skip('GET /api/requests/:id (단건 조회)', () => {
  test('존재하는 Request ID로 단건 조회하면 200을 반환한다 (happy path)', async ({
    request,
  }) => {
    // 시드 데이터의 externalId로 먼저 목록 조회하여 실제 ID 획득
    const listResponse = await request.get('/api/requests');
    const list = await listResponse.json();
    const seedRequest = list.find(
      (r: { externalId: string }) => r.externalId === 'e2e-pending-001'
    );

    expect(seedRequest).toBeDefined();

    const response = await request.get(`/api/requests/${seedRequest.id}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(seedRequest.id);
    expect(body.externalId).toBe('e2e-pending-001');
  });

  test('존재하지 않는 ID로 조회하면 404를 반환한다 (error case)', async ({ request }) => {
    const response = await request.get('/api/requests/nonexistent-request-id-000');

    expect(response.status()).toBe(404);
  });
});

// TODO: Activate when DLD-647 is implemented
test.describe.skip('PATCH /api/requests/:id/approve (승인)', () => {
  const createdExternalIds: string[] = [];

  test.afterEach(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
  });

  test('PENDING 요청을 승인하면 status가 APPROVED로 변경된다 (happy path)', async ({
    request,
  }) => {
    // 새 PENDING 요청 생성
    const externalId = `e2e-approve-${Date.now()}`;
    createdExternalIds.push(externalId);

    await request.post('/api/requests', {
      data: { externalId, context: '승인 테스트 요청', requesterName: 'Bot' },
    });

    // 목록에서 ID 확인
    const listResponse = await request.get('/api/requests?status=PENDING');
    const list = await listResponse.json();
    const targetRequest = list.find((r: { externalId: string }) => r.externalId === externalId);
    expect(targetRequest).toBeDefined();

    // 인증 토큰 획득 후 승인
    const { token } = await loginAsAdmin(request);
    const approveResponse = await request.patch(
      `/api/requests/${targetRequest.id}/approve`,
      withAuthHeader(token)
    );

    expect(approveResponse.status()).toBe(200);

    const body = await approveResponse.json();
    expect(body.status).toBe('APPROVED');
    expect(body.processedAt).toBeDefined();
    expect(body.processedById).toBeDefined();
  });

  test('이미 APPROVED된 요청을 재승인하면 409를 반환한다 (edge case)', async ({ request }) => {
    const { token } = await loginAsAdmin(request);

    // 시드 데이터의 이미 승인된 요청 ID 획득
    const listResponse = await request.get('/api/requests?status=APPROVED');
    const list = await listResponse.json();
    const approvedRequest = list.find(
      (r: { externalId: string }) => r.externalId === 'e2e-approved-001'
    );
    expect(approvedRequest).toBeDefined();

    const response = await request.patch(
      `/api/requests/${approvedRequest.id}/approve`,
      withAuthHeader(token)
    );

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
    const { token } = await loginAsAdmin(request);

    const response = await request.patch(
      '/api/requests/nonexistent-id-000/approve',
      withAuthHeader(token)
    );

    expect(response.status()).toBe(404);
  });
});

// TODO: Activate when DLD-647 is implemented
test.describe.skip('PATCH /api/requests/:id/reject (거절)', () => {
  const createdExternalIds: string[] = [];

  test.afterEach(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
  });

  test('PENDING 요청을 거절하면 status가 REJECTED로 변경된다 (happy path)', async ({
    request,
  }) => {
    const externalId = `e2e-reject-${Date.now()}`;
    createdExternalIds.push(externalId);

    await request.post('/api/requests', {
      data: { externalId, context: '거절 테스트 요청', requesterName: 'Bot' },
    });

    const listResponse = await request.get('/api/requests?status=PENDING');
    const list = await listResponse.json();
    const targetRequest = list.find((r: { externalId: string }) => r.externalId === externalId);
    expect(targetRequest).toBeDefined();

    const { token } = await loginAsAdmin(request);
    const rejectResponse = await request.patch(
      `/api/requests/${targetRequest.id}/reject`,
      withAuthHeader(token)
    );

    expect(rejectResponse.status()).toBe(200);

    const body = await rejectResponse.json();
    expect(body.status).toBe('REJECTED');
    expect(body.processedAt).toBeDefined();
  });

  test('이미 REJECTED된 요청을 재거절하면 409를 반환한다 (edge case)', async ({ request }) => {
    const { token } = await loginAsAdmin(request);

    const listResponse = await request.get('/api/requests?status=REJECTED');
    const list = await listResponse.json();
    const rejectedRequest = list.find(
      (r: { externalId: string }) => r.externalId === 'e2e-rejected-001'
    );
    expect(rejectedRequest).toBeDefined();

    const response = await request.patch(
      `/api/requests/${rejectedRequest.id}/reject`,
      withAuthHeader(token)
    );

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
test.describe.skip('POST /api/requests (확인 요청 생성 - API Key 인증)', () => {
  /**
   * DLD-650: 작업 3-1: [확인 요청 생성] e2e 테스트 작성 (skipped)
   * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
   *
   * API Key 기반 인증으로 POST /api/requests를 호출하는 시나리오를 검증합니다.
   * API Key 모델, x-api-key 헤더 검증 로직은 아직 미구현 상태입니다.
   * 테스트는 향후 구현될 형태를 예상하여 작성되었습니다.
   */

  // 유효한 테스트용 API Key (global-setup.ts의 seedDatabase()에서 생성된 값과 일치해야 합니다)
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
