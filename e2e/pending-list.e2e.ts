import { test, expect } from '@playwright/test';
import {
  cleanupTestData,
  createTestRequest,
  findRequestByExternalId,
  updateAllPendingRequestsStatus,
  restoreRequestsToPending,
} from './helpers/db';
import { TEST_USERS } from './helpers/auth';

/**
 * 대기 목록 화면 E2E 테스트
 *
 * DLD-655: 작업 5-2: [대기 목록 화면] 구현 및 e2e 테스트 활성화
 * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
 *
 * 커버리지:
 * - PENDING 요청 카드 렌더링 (context, requesterName 표시)
 * - 타임아웃 있는 요청 카드의 남은 시간 표시 (amber 색상, animate-pulse)
 * - 타임아웃 없는 요청 카드의 "제한 없음" 표시 (gray 색상)
 * - PENDING 요청이 없을 때 빈 상태 UI 표시
 * - 카드 클릭 시 요청 상세 페이지(/requests/{id})로 이동
 * - /login 접근 시 404 또는 /requests 리다이렉트 확인
 * - 승인/거절 API 호출이 Bearer 헤더 없이 성공하는지 확인
 */

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    'x-authentik-uid': TEST_USERS.admin.authentikUid,
    'x-authentik-username': TEST_USERS.admin.username,
    'x-authentik-email': TEST_USERS.admin.email,
  });
});

test.describe('대기 목록 화면 (/requests)', () => {
  test('대기 목록 페이지에 접근하면 PENDING 요청이 카드로 렌더링된다 (happy path)', async ({
    page,
  }) => {
    // Act: 직접 페이지 접근 (E2E_FORWARD_AUTH_USER 환경변수로 전역 인증 주입)
    await page.goto('/requests');

    // Act: 글로벌 시드 데이터의 PENDING 요청(e2e-pending-001) 카드 확인
    const pendingRequest = await findRequestByExternalId('e2e-pending-001');
    expect(pendingRequest).not.toBeNull();

    // Assert: 카드에 context, requesterName이 표시됨
    const card = page.locator(`[data-request-id="${pendingRequest!.id}"]`);
    await expect(card).toBeVisible();
    await expect(card.getByText(pendingRequest!.context)).toBeVisible();
    await expect(card.getByText(pendingRequest!.requesterName)).toBeVisible();
  });

  test('timeoutSeconds가 설정된 PENDING 요청 카드에 남은 시간이 amber 색상으로 표시된다 (happy path)', async ({
    page,
  }) => {
    // Act: 직접 페이지 접근
    await page.goto('/requests');

    // Act: 글로벌 시드 데이터의 타임아웃 있는 PENDING 요청(e2e-timeout-001) 카드 확인
    const timeoutRequest = await findRequestByExternalId('e2e-timeout-001');
    expect(timeoutRequest).not.toBeNull();

    const card = page.locator(`[data-request-id="${timeoutRequest!.id}"]`);
    await expect(card).toBeVisible();

    // Assert: 남은 시간이 amber 색상(text-amber-600)으로 표시됨
    const remainingTimeEl = card.locator('.text-amber-600');
    await expect(remainingTimeEl).toBeVisible();

    // Assert: animate-pulse 점 표시 확인
    const pulseDot = card.locator('.animate-pulse');
    await expect(pulseDot).toBeVisible();
  });

  test('timeoutSeconds가 null인 PENDING 요청 카드에 "제한 없음"이 gray 색상으로 표시된다 (happy path)', async ({
    page,
  }) => {
    // Act: 직접 페이지 접근
    await page.goto('/requests');

    // Act: 글로벌 시드 데이터의 타임아웃 없는 PENDING 요청(e2e-pending-001) 카드 확인
    const noTimeoutRequest = await findRequestByExternalId('e2e-pending-001');
    expect(noTimeoutRequest).not.toBeNull();
    expect(noTimeoutRequest!.timeoutSeconds).toBeNull();

    const card = page.locator(`[data-request-id="${noTimeoutRequest!.id}"]`);
    await expect(card).toBeVisible();

    // Assert: "제한 없음" 텍스트가 gray 색상(text-gray-400)으로 표시됨
    const noLimitEl = card.locator('.text-gray-400', { hasText: '제한 없음' });
    await expect(noLimitEl).toBeVisible();
  });

  test('PENDING 상태의 요청이 없을 때 빈 상태 UI가 표시된다 (edge case)', async ({ page }) => {
    // Arrange: 모든 PENDING 요청을 APPROVED로 임시 변경하여 빈 상태 유도
    const changedIds = await updateAllPendingRequestsStatus('APPROVED');

    try {
      // Act: 직접 페이지 접근
      await page.goto('/requests');

      // Assert: "대기 중인 요청이 없습니다" 텍스트가 표시됨
      await expect(page.getByText('대기 중인 요청이 없습니다')).toBeVisible();
    } finally {
      // 복원: 변경된 요청들을 다시 PENDING으로 되돌림
      await restoreRequestsToPending(changedIds);
    }
  });

  test('PENDING 요청 카드를 클릭하면 요청 상세 페이지로 이동한다 (happy path)', async ({
    page,
  }) => {
    // Act: 직접 페이지 접근
    await page.goto('/requests');

    // Act: 글로벌 시드 데이터의 PENDING 요청(e2e-pending-001) 카드 클릭
    const pendingRequest = await findRequestByExternalId('e2e-pending-001');
    expect(pendingRequest).not.toBeNull();

    const card = page.locator(`[data-request-id="${pendingRequest!.id}"]`);
    await expect(card).toBeVisible();
    await card.click();

    // Assert: /requests/{id} 페이지로 이동
    await expect(page).toHaveURL(`/requests/${pendingRequest!.id}`);
  });
});

test.describe('/login 경로 접근 동작', () => {
  test('/login 접근 시 404 또는 /requests로 리다이렉트된다 (happy path)', async ({ page }) => {
    // Act: /login 경로로 직접 접근
    const response = await page.goto('/login');

    // Assert: 404 응답이거나 /requests로 리다이렉트됨
    const is404 = response?.status() === 404;
    const isRedirected = page.url().includes('/requests');

    expect(is404 || isRedirected).toBe(true);
  });
});

test.describe('Bearer 헤더 없이 API 호출 검증', () => {
  const createdExternalIds: string[] = [];

  test.afterAll(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
  });

  test('승인 버튼 클릭 시 Bearer 헤더 없이 PATCH /api/requests/:id/approve 가 성공한다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 이 테스트 전용 PENDING 요청 생성
    const externalId = `e2e-bearer-approve-${Date.now()}`;
    createdExternalIds.push(externalId);
    const pendingRequest = await createTestRequest({
      externalId,
      context: 'Bearer 헤더 없이 승인 테스트용 요청입니다.',
      requesterName: 'E2E Bearer Test Bot',
      status: 'PENDING',
    });

    // Arrange: 요청 헤더 캡처 준비
    const capturedHeaders: Record<string, string>[] = [];
    await page.route('**/api/requests/**/approve', (route) => {
      capturedHeaders.push(route.request().headers());
      route.continue();
    });

    // Act: 직접 요청 상세 페이지 접근
    await page.goto(`/requests/${pendingRequest.id}`);
    await expect(page.getByRole('heading', { name: '요청 상세' })).toBeVisible();

    // Act: 승인 버튼 클릭
    await page.getByRole('button', { name: '승인' }).click();
    await page.getByRole('button', { name: '확인' }).click();

    // Assert: 대기 목록으로 복귀 (API 호출 성공 확인)
    await expect(page).toHaveURL('/requests');

    // Assert: 캡처된 요청 헤더에 Authorization (Bearer) 헤더가 없음
    if (capturedHeaders.length > 0) {
      const headers = capturedHeaders[0];
      expect(headers['authorization']).toBeUndefined();
    }
  });

  test('거절 버튼 클릭 시 Bearer 헤더 없이 PATCH /api/requests/:id/reject 가 성공한다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 이 테스트 전용 PENDING 요청 생성
    const externalId = `e2e-bearer-reject-${Date.now()}`;
    createdExternalIds.push(externalId);
    const pendingRequest = await createTestRequest({
      externalId,
      context: 'Bearer 헤더 없이 거절 테스트용 요청입니다.',
      requesterName: 'E2E Bearer Test Bot',
      status: 'PENDING',
    });

    // Arrange: 요청 헤더 캡처 준비
    const capturedHeaders: Record<string, string>[] = [];
    await page.route('**/api/requests/**/reject', (route) => {
      capturedHeaders.push(route.request().headers());
      route.continue();
    });

    // Act: 직접 요청 상세 페이지 접근
    await page.goto(`/requests/${pendingRequest.id}`);
    await expect(page.getByRole('heading', { name: '요청 상세' })).toBeVisible();

    // Act: 거절 버튼 클릭
    await page.getByRole('button', { name: '거절' }).click();
    await page.getByRole('button', { name: '확인' }).click();

    // Assert: 대기 목록으로 복귀 (API 호출 성공 확인)
    await expect(page).toHaveURL('/requests');

    // Assert: 캡처된 요청 헤더에 Authorization (Bearer) 헤더가 없음
    if (capturedHeaders.length > 0) {
      const headers = capturedHeaders[0];
      expect(headers['authorization']).toBeUndefined();
    }
  });
});
