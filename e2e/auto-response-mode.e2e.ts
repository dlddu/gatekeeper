import { test, expect } from '@playwright/test';
import { TEST_USERS, forwardAuthHeaders } from './helpers/auth';
import { cleanupTestData, createTestPrismaClient, findUserByUsername } from './helpers/db';

/**
 * 자동 응답 모드 E2E 테스트
 *
 * 커버리지:
 * - PATCH /api/me/auto-response-mode: 모드 변경 API
 * - GET /api/me: autoResponseMode 필드 포함 확인
 * - POST /api/requests + AUTO_REJECT 유저: 자동 거부 처리
 * - POST /api/requests + AUTO_APPROVE 유저: 자동 승인 처리
 * - POST /api/requests + NONE 유저: 기존 PENDING 동작 유지
 * - 설정 페이지 UI: 자동 응답 모드 선택 버튼 렌더링 및 동작
 */

const E2E_API_KEY = process.env.API_SECRET_KEY ?? 'e2e-test-api-key-valid';

function withApiKeyHeader(): { headers: Record<string, string> } {
  return {
    headers: {
      'x-api-key': E2E_API_KEY,
    },
  };
}

/**
 * 유저의 autoResponseMode를 DB에서 직접 초기화
 */
async function resetAutoResponseMode(username: string, mode: 'NONE' | 'AUTO_APPROVE' | 'AUTO_REJECT' = 'NONE'): Promise<void> {
  const prisma = await createTestPrismaClient();
  try {
    await prisma.user.update({
      where: { username },
      data: { autoResponseMode: mode },
    });
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================================
// API 테스트: PATCH /api/me/auto-response-mode
// ============================================================

test.describe('PATCH /api/me/auto-response-mode (자동 응답 모드 변경 API)', () => {
  test.afterEach(async () => {
    await resetAutoResponseMode('admin', 'NONE');
  });

  test('AUTO_REJECT 모드로 변경하면 200과 변경된 모드를 반환한다 (happy path)', async ({ request }) => {
    const response = await request.patch('/api/me/auto-response-mode', {
      ...forwardAuthHeaders(TEST_USERS.admin),
      data: { mode: 'AUTO_REJECT' },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.autoResponseMode).toBe('AUTO_REJECT');
  });

  test('AUTO_APPROVE 모드로 변경하면 200과 변경된 모드를 반환한다 (happy path)', async ({ request }) => {
    const response = await request.patch('/api/me/auto-response-mode', {
      ...forwardAuthHeaders(TEST_USERS.admin),
      data: { mode: 'AUTO_APPROVE' },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.autoResponseMode).toBe('AUTO_APPROVE');
  });

  test('NONE 모드로 변경하면 200과 변경된 모드를 반환한다 (happy path)', async ({ request }) => {
    // Arrange: 먼저 AUTO_REJECT로 변경
    await request.patch('/api/me/auto-response-mode', {
      ...forwardAuthHeaders(TEST_USERS.admin),
      data: { mode: 'AUTO_REJECT' },
    });

    // Act: NONE으로 변경
    const response = await request.patch('/api/me/auto-response-mode', {
      ...forwardAuthHeaders(TEST_USERS.admin),
      data: { mode: 'NONE' },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.autoResponseMode).toBe('NONE');
  });

  test('잘못된 mode 값으로 요청하면 400을 반환한다 (error case)', async ({ request }) => {
    const response = await request.patch('/api/me/auto-response-mode', {
      ...forwardAuthHeaders(TEST_USERS.admin),
      data: { mode: 'INVALID_MODE' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('mode 필드 없이 요청하면 400을 반환한다 (error case)', async ({ request }) => {
    const response = await request.patch('/api/me/auto-response-mode', {
      ...forwardAuthHeaders(TEST_USERS.admin),
      data: {},
    });

    expect(response.status()).toBe(400);
  });

  test('인증 없이 요청하면 401을 반환한다 (error case)', async ({ request }) => {
    const response = await request.patch('/api/me/auto-response-mode', {
      data: { mode: 'AUTO_REJECT' },
    });

    expect(response.status()).toBe(401);
  });
});

// ============================================================
// API 테스트: GET /api/me에 autoResponseMode 포함
// ============================================================

test.describe('GET /api/me (autoResponseMode 포함)', () => {
  test.afterEach(async () => {
    await resetAutoResponseMode('admin', 'NONE');
  });

  test('기본 상태에서 autoResponseMode가 NONE으로 반환된다 (happy path)', async ({ request }) => {
    const response = await request.get('/api/me', forwardAuthHeaders(TEST_USERS.admin));

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.autoResponseMode).toBe('NONE');
  });

  test('AUTO_REJECT로 변경 후 GET /api/me에서 반영된 모드를 반환한다 (happy path)', async ({ request }) => {
    // Arrange: 모드 변경
    await request.patch('/api/me/auto-response-mode', {
      ...forwardAuthHeaders(TEST_USERS.admin),
      data: { mode: 'AUTO_REJECT' },
    });

    // Act
    const response = await request.get('/api/me', forwardAuthHeaders(TEST_USERS.admin));

    // Assert
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.autoResponseMode).toBe('AUTO_REJECT');
  });
});

// ============================================================
// API 테스트: POST /api/requests 자동 응답 동작
// ============================================================

test.describe('POST /api/requests (자동 응답 모드 동작)', () => {
  const createdExternalIds: string[] = [];

  test.afterEach(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
    await resetAutoResponseMode('admin', 'NONE');
  });

  test('AUTO_REJECT 유저에게 요청을 보내면 자동으로 REJECTED 상태로 생성된다 (happy path)', async ({ request }) => {
    // Arrange: admin 유저를 AUTO_REJECT 모드로 설정
    await resetAutoResponseMode('admin', 'AUTO_REJECT');
    const user = await findUserByUsername('admin');
    expect(user).not.toBeNull();

    const externalId = `e2e-auto-reject-${Date.now()}`;
    createdExternalIds.push(externalId);

    // Act: 해당 유저를 대상으로 요청 생성
    const response = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: '자동 거부 테스트용 요청',
        requesterName: 'E2E Bot',
        userId: user!.id,
      },
    });

    // Assert
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.status).toBe('REJECTED');
    expect(body.autoRejected).toBe(true);
  });

  test('AUTO_APPROVE 유저에게 요청을 보내면 자동으로 APPROVED 상태로 생성된다 (happy path)', async ({ request }) => {
    // Arrange: admin 유저를 AUTO_APPROVE 모드로 설정
    await resetAutoResponseMode('admin', 'AUTO_APPROVE');
    const user = await findUserByUsername('admin');
    expect(user).not.toBeNull();

    const externalId = `e2e-auto-approve-${Date.now()}`;
    createdExternalIds.push(externalId);

    // Act: 해당 유저를 대상으로 요청 생성
    const response = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: '자동 승인 테스트용 요청',
        requesterName: 'E2E Bot',
        userId: user!.id,
      },
    });

    // Assert
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.status).toBe('APPROVED');
    expect(body.autoApproved).toBe(true);
  });

  test('NONE 모드 유저에게 요청을 보내면 기존대로 PENDING 상태로 생성된다 (happy path)', async ({ request }) => {
    // Arrange: admin 유저는 기본 NONE 모드
    const user = await findUserByUsername('admin');
    expect(user).not.toBeNull();

    const externalId = `e2e-none-mode-${Date.now()}`;
    createdExternalIds.push(externalId);

    // Act
    const response = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: 'NONE 모드 테스트용 요청',
        requesterName: 'E2E Bot',
        userId: user!.id,
      },
    });

    // Assert
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.status).toBe('PENDING');
    expect(body.autoRejected).toBeUndefined();
    expect(body.autoApproved).toBeUndefined();
  });

  test('userId 없이 요청하면 AUTO_REJECT 유저가 있어도 PENDING으로 생성된다 (edge case)', async ({ request }) => {
    // Arrange: admin 유저를 AUTO_REJECT 모드로 설정
    await resetAutoResponseMode('admin', 'AUTO_REJECT');

    const externalId = `e2e-no-userid-${Date.now()}`;
    createdExternalIds.push(externalId);

    // Act: userId 없이 요청
    const response = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: 'userId 없는 요청',
        requesterName: 'E2E Bot',
      },
    });

    // Assert: userId가 없으므로 자동 응답 모드 미적용, PENDING
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.status).toBe('PENDING');
  });

  test('자동 거부된 요청의 processedById에 대상 유저 ID가 기록된다 (happy path)', async ({ request }) => {
    // Arrange
    await resetAutoResponseMode('admin', 'AUTO_REJECT');
    const user = await findUserByUsername('admin');
    expect(user).not.toBeNull();

    const externalId = `e2e-auto-reject-pid-${Date.now()}`;
    createdExternalIds.push(externalId);

    // Act
    const createResponse = await request.post('/api/requests', {
      ...withApiKeyHeader(),
      data: {
        externalId,
        context: 'processedById 검증용',
        requesterName: 'E2E Bot',
        userId: user!.id,
      },
    });

    expect(createResponse.status()).toBe(201);

    // Assert: polling API로 상세 확인
    const created = await createResponse.json();
    const detailResponse = await request.get(`/api/requests/${created.id}`, withApiKeyHeader());
    expect(detailResponse.status()).toBe(200);
    const detail = await detailResponse.json();

    expect(detail.status).toBe('REJECTED');
    expect(detail.processedById).toBe(user!.id);
    expect(detail.processedAt).toBeTruthy();
  });
});

// ============================================================
// UI 테스트: 설정 페이지 자동 응답 모드 선택
// ============================================================

test.describe('설정 페이지 자동 응답 모드 UI (/settings)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({
      'Remote-User': TEST_USERS.admin.autheliaId,
      'Remote-Email': TEST_USERS.admin.email,
      'Remote-Name': TEST_USERS.admin.displayName,
    });
  });

  test.afterEach(async () => {
    await resetAutoResponseMode('admin', 'NONE');
  });

  test('설정 페이지에 "자동 응답 모드" 섹션이 렌더링된다 (happy path)', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible();

    // Assert: 자동 응답 모드 텍스트가 표시됨
    await expect(page.getByText('자동 응답 모드')).toBeVisible();
  });

  test('3가지 모드 선택 버튼이 모두 표시된다 (happy path)', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('자동 응답 모드')).toBeVisible();

    // Assert: 3가지 버튼 모두 표시
    await expect(page.getByRole('button', { name: '없음' })).toBeVisible();
    await expect(page.getByRole('button', { name: '자동 승인' })).toBeVisible();
    await expect(page.getByRole('button', { name: '자동 거부' })).toBeVisible();
  });

  test('기본 상태에서 "없음" 버튼이 활성화되어 있고 기본 안내 문구가 표시된다 (happy path)', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('자동 응답 모드')).toBeVisible();

    // Assert: 기본 안내 문구
    await expect(page.getByText('수동으로 요청을 승인하거나 거부합니다')).toBeVisible();
  });

  test('"자동 거부" 버튼을 클릭하면 모드가 변경되고 안내 문구가 업데이트된다 (happy path)', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('자동 응답 모드')).toBeVisible();

    // Arrange: API 호출 대기 준비
    const apiPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/api/me/auto-response-mode') && req.method() === 'PATCH'
    );

    // Act: 자동 거부 버튼 클릭
    await page.getByRole('button', { name: '자동 거부' }).click();

    // Assert: API 호출됨
    await apiPromise;

    // Assert: 안내 문구 업데이트
    await expect(page.getByText('새로운 요청이 자동으로 거부됩니다')).toBeVisible();
  });

  test('"자동 승인" 버튼을 클릭하면 모드가 변경되고 안내 문구가 업데이트된다 (happy path)', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('자동 응답 모드')).toBeVisible();

    // Arrange: API 호출 대기 준비
    const apiPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/api/me/auto-response-mode') && req.method() === 'PATCH'
    );

    // Act: 자동 승인 버튼 클릭
    await page.getByRole('button', { name: '자동 승인' }).click();

    // Assert: API 호출됨
    await apiPromise;

    // Assert: 안내 문구 업데이트
    await expect(page.getByText('새로운 요청이 자동으로 승인됩니다')).toBeVisible();
  });

  test('페이지 새로고침 후에도 변경된 모드가 유지된다 (happy path)', async ({ page }) => {
    // Arrange: 자동 거부 모드로 설정
    await resetAutoResponseMode('admin', 'AUTO_REJECT');

    // Act: 설정 페이지 로드
    await page.goto('/settings');
    await expect(page.getByText('자동 응답 모드')).toBeVisible();

    // Assert: 거부 모드 안내 문구가 표시됨 (DB에서 모드를 로드)
    await expect(page.getByText('새로운 요청이 자동으로 거부됩니다')).toBeVisible();
  });
});
