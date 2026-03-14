import { test, expect } from '@playwright/test';

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

test.describe('헬스 체크', () => {
  test('GET /api/health 가 정상 응답을 반환한다', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });
});

test.describe('회원가입 및 인증', () => {
  const testUsername = uniqueId('kind-user');
  const testPassword = 'testpass123456';
  let authToken: string;

  test('POST /api/auth/signup 으로 새 사용자를 등록할 수 있다', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: {
        username: testUsername,
        password: testPassword,
        displayName: 'Kind E2E Test User',
      },
    });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('token');
    expect(body).toHaveProperty('username', testUsername);
    authToken = body.token;
  });

  test('POST /api/auth/login 으로 로그인할 수 있다', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        username: testUsername,
        password: testPassword,
      },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('token');
    authToken = body.token;
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
  const testUsername = uniqueId('kind-crud');
  const testPassword = 'testpass123456';

  test.beforeAll(async ({ request }) => {
    // 테스트용 사용자 생성 및 로그인
    await request.post('/api/auth/signup', {
      data: {
        username: testUsername,
        password: testPassword,
        displayName: 'Kind CRUD Test User',
      },
    });

    const loginRes = await request.post('/api/auth/login', {
      data: { username: testUsername, password: testPassword },
    });
    const loginBody = await loginRes.json();
    authToken = loginBody.token;
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
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/requests/:id 로 개별 요청을 조회할 수 있다', async ({ request }) => {
    const response = await request.get(`/api/requests/${createdRequestId}`, {
      headers: { 'x-api-key': API_SECRET_KEY },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('externalId', testExternalId);
    expect(body).toHaveProperty('status', 'PENDING');
  });

  test('PATCH /api/requests/:id/approve 로 요청을 승인할 수 있다', async ({ request }) => {
    const response = await request.patch(`/api/requests/${createdRequestId}/approve`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'APPROVED');
  });

  test('승인된 요청을 다시 처리할 수 없다', async ({ request }) => {
    const response = await request.patch(`/api/requests/${createdRequestId}/reject`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    // 이미 처리된 요청은 에러 반환 (409 Conflict)
    expect(response.status()).toBe(409);
  });
});

test.describe('요청 거절 플로우', () => {
  let authToken: string;
  let requestId: string;
  const testExternalId = uniqueId('kind-reject');
  const testUsername = uniqueId('kind-rejector');
  const testPassword = 'testpass123456';

  test.beforeAll(async ({ request }) => {
    // 사용자 생성 및 로그인
    await request.post('/api/auth/signup', {
      data: {
        username: testUsername,
        password: testPassword,
        displayName: 'Kind Reject Test User',
      },
    });

    const loginRes = await request.post('/api/auth/login', {
      data: { username: testUsername, password: testPassword },
    });
    const loginBody = await loginRes.json();
    authToken = loginBody.token;

    // 테스트용 요청 생성
    const reqRes = await request.post('/api/requests', {
      headers: { 'x-api-key': API_SECRET_KEY },
      data: {
        externalId: testExternalId,
        context: 'Kind 거절 테스트용 요청',
        requesterName: 'Kind Reject Requester',
      },
    });
    const reqBody = await reqRes.json();
    requestId = reqBody.id;
  });

  test('PATCH /api/requests/:id/reject 로 요청을 거절할 수 있다', async ({ request }) => {
    const response = await request.patch(`/api/requests/${requestId}/reject`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'REJECTED');
  });
});

test.describe('브라우저 UI 렌더링', () => {
  test('로그인 페이지가 정상적으로 렌더링된다', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Gatekeeper/i);

    // 로그인 폼 요소 확인
    await expect(page.locator('input[name="username"], input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[name="password"], input[type="password"]').first()).toBeVisible();
  });

  test('브라우저에서 로그인 후 대시보드에 접근할 수 있다', async ({ page }) => {
    const testUsername = uniqueId('kind-ui');
    const testPassword = 'testpass123456';

    // API로 사용자 먼저 생성
    const signupRes = await page.request.post('/api/auth/signup', {
      data: {
        username: testUsername,
        password: testPassword,
        displayName: 'Kind UI Test User',
      },
    });
    expect(signupRes.status()).toBe(201);

    // 브라우저에서 로그인
    await page.goto('/login');
    await page.locator('input[name="username"], input[type="text"]').first().fill(testUsername);
    await page.locator('input[name="password"], input[type="password"]').first().fill(testPassword);
    await page.locator('button[type="submit"]').click();

    // 로그인 성공 후 리다이렉트 확인
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
  });
});
