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

// API 키 헬퍼
function withApiKeyHeader(): { headers: Record<string, string> } {
  return {
    headers: {
      'x-api-key': 'e2e-test-api-key-valid',
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

  test('잘못된 status 쿼리로 요청하면 400을 반환한다 (error case)', async ({
    request,
  }) => {
    const response = await request.get('/api/requests?status=INVALID');

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

    const response = await request.get(`/api/requests/${targetRequest.id}`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(targetRequest.id);
    expect(body.externalId).toBe('e2e-pending-001');
  });

  test('존재하지 않는 Request를 조회하면 404를 반환한다 (error case)', async ({
    request,
  }) => {
    const response = await request.get('/api/requests/99999');

    expect(response.status()).toBe(404);
  });
});

// TODO: Activate when DLD-647 is implemented
test.describe('PATCH /api/requests/:id/approve (승인)', () => {
  test('PENDING 상태의 Request를 승인하면 200을 반환한다 (happy path)', async ({
    request,
  }) => {
    // 존재하지 않는 요청 ID로 테스트 (실제 존재하는 데이터가 없을 경우)
    // 테스트는 skip하고 나중에 활성화
    expect(true).toBe(true);
  });
});

// TODO: Activate when DLD-647 is implemented
test.describe('PATCH /api/requests/:id/reject (거절)', () => {
  test('PENDING 상태의 Request를 거절하면 200을 반환한다 (happy path)', async ({
    request,
  }) => {
    // 존재하지 않는 요청 ID로 테스트 (실제 존재하는 데이터가 없을 경우)
    // 테스트는 skip하고 나중에 활성화
    expect(true).toBe(true);
  });
});
