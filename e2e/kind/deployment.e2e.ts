import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAsAdmin } from '../helpers/auth';

/**
 * Kind 클러스터 배포 E2E 테스트
 *
 * Kind 클러스터에 배포된 Gatekeeper 애플리케이션의 전체 동작을 검증합니다.
 * 로컬 DB 접근 없이 API와 브라우저를 통해서만 테스트합니다.
 *
 * 검증 항목:
 * - 헬스 체크 엔드포인트
 * - 회원가입 및 로그인 플로우
 * - 요청 생성, 조회, 승인/거절
 * - 기본 UI 렌더링
 */

const API_SECRET_KEY = process.env.API_SECRET_KEY || 'e2e-test-api-key-valid';

// 테스트별 고유 식별자 생성
function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// 디버깅용: API 응답 상세 로그 출력
async function debugResponse(label: string, response: { status: () => number; text: () => Promise<string>; url: () => string }) {
  const status = response.status();
  const body = await response.text();
  console.log(`[DEBUG] ${label} | URL: ${response.url()} | Status: ${status} | Body: ${body.slice(0, 500)}`);
}

test.describe('헬스 체크', () => {
  test('GET /api/health 가 정상 응답을 반환한다', async ({ request }) => {
    const response = await request.get('/api/health');
    await debugResponse('health', response);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });
});

test.describe('회원가입 및 인증', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const auth = await loginAsAdmin(request);
    authToken = auth.token;
  });

  test('POST /api/auth/signup 엔드포인트가 제거되었다 (404)', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: {
        username: 'any-user',
        password: 'anypass123',
        displayName: 'Any User',
      },
    });
    await debugResponse('signup-removed', response);
    expect(response.status()).toBe(404);
  });

  test('POST /api/auth/login 으로 로그인할 수 있다', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        username: TEST_USERS.admin.username,
        password: TEST_USERS.admin.password,
      },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('token');
  });

  test('인증된 사용자가 보호된 API에 접근할 수 있다', async ({ request }) => {
    const response = await request.get('/api/me/requests/pending', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.status()).toBe(200);
  });

  test('인증되지 않은 요청은 거부된다', async ({ request }) => {
    const response = await request.get('/api/me/requests/pending');
    expect(response.status()).toBe(401);
  });
});

test.describe('요청(Request) CRUD', () => {
  let authToken: string;
  let createdRequestId: string;
  const testExternalId = uniqueId('kind-req');

  test.beforeAll(async ({ request }) => {
    const auth = await loginAsAdmin(request);
    authToken = auth.token;
    console.log(`[DEBUG] CRUD authToken obtained: ${!!authToken}`);
  });

  test('POST /api/requests 로 새 요청을 생성할 수 있다', async ({ request }) => {
    const response = await request.post('/api/requests', {
      headers: {
        'x-api-key': API_SECRET_KEY,
      },
      data: {
        externalId: testExternalId,
        context: 'Kind 클러스터 E2E 테스트 요청입니다.',
        requesterName: 'Kind E2E Requester',
      },
    });
    await debugResponse('create-request', response);
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('externalId', testExternalId);
    expect(body).toHaveProperty('status', 'PENDING');
    createdRequestId = body.id;
  });

  test('GET /api/requests 로 요청 목록을 조회할 수 있다', async ({ request }) => {
    const response = await request.get('/api/requests', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    await debugResponse('list-requests', response);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/requests/:id 로 개별 요청을 조회할 수 있다', async ({ request }) => {
    console.log(`[DEBUG] createdRequestId = ${createdRequestId}`);
    const response = await request.get(`/api/requests/${createdRequestId}`, {
      headers: { 'x-api-key': API_SECRET_KEY },
    });
    await debugResponse('get-request-by-id', response);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('externalId', testExternalId);
    expect(body).toHaveProperty('status', 'PENDING');
  });

  test('PATCH /api/requests/:id/approve 로 요청을 승인할 수 있다', async ({ request }) => {
    const response = await request.patch(`/api/requests/${createdRequestId}/approve`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    await debugResponse('approve-request', response);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'APPROVED');
  });

  test('승인된 요청을 다시 처리할 수 없다', async ({ request }) => {
    const response = await request.patch(`/api/requests/${createdRequestId}/reject`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    await debugResponse('reject-already-processed', response);
    // 이미 처리된 요청은 에러 반환 (409 Conflict)
    expect(response.status()).toBe(409);
  });
});

test.describe('요청 거절 플로우', () => {
  let authToken: string;
  let requestId: string;
  const testExternalId = uniqueId('kind-reject');

  test.beforeAll(async ({ request }) => {
    const auth = await loginAsAdmin(request);
    authToken = auth.token;
    console.log(`[DEBUG] Reject authToken obtained: ${!!authToken}`);

    // 테스트용 요청 생성
    const reqRes = await request.post('/api/requests', {
      headers: { 'x-api-key': API_SECRET_KEY },
      data: {
        externalId: testExternalId,
        context: 'Kind 거절 테스트용 요청',
        requesterName: 'Kind Reject Requester',
      },
    });
    await debugResponse('reject-create-request', reqRes);
    const reqBody = await reqRes.json();
    requestId = reqBody.id;
    console.log(`[DEBUG] Reject requestId: ${requestId}`);
  });

  test('PATCH /api/requests/:id/reject 로 요청을 거절할 수 있다', async ({ request }) => {
    const response = await request.patch(`/api/requests/${requestId}/reject`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    await debugResponse('reject-request', response);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'REJECTED');
  });
});

test.describe('브라우저 UI 렌더링', () => {
  test('로그인 페이지가 정상적으로 렌더링된다', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Gatekeeper/i);

    // OIDC 로그인 UI 요소 확인
    await expect(page.getByRole('heading', { name: 'Gatekeeper' })).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  });

  test('로그인 버튼 클릭 시 OIDC 인가 엔드포인트로 이동한다', async ({ page }) => {
    await page.goto('/login');

    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/auth/oidc/authorize')),
      page.getByRole('button', { name: '로그인' }).click(),
    ]);

    // OIDC authorize 엔드포인트가 호출되었는지 확인
    expect(response.url()).toContain('/api/auth/oidc/authorize');
  });
});
