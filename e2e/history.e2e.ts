import { test, expect } from '@playwright/test';
import { TEST_USERS } from './helpers/auth';
import { cleanupTestData, createTestRequest, findRequestByExternalId } from './helpers/db';

/**
 * 처리 이력 화면 E2E 테스트
 *
 * DLD-658: 작업 7-1: [처리 이력 화면] e2e 테스트 작성 (skipped)
 * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
 *
 * 커버리지:
 * - 이력 페이지 접근 시 처리된 요청 카드 렌더링 확인 (승인/거절/만료)
 * - 상태 배지 색상 및 텍스트 정확성 확인 (승인/거절/만료)
 * - 처리 이력 없을 때 빈 상태 UI 표시 확인
 * - 페이지네이션 / 더 보기 동작 확인
 * - 하단 네비게이션 이력 탭 active 상태 확인
 * - 카드 내 요청 ID (mono font), 맥락, 요청자, 처리 시각 표시 확인
 * - 에러 상태 UI 및 재시도 버튼 확인
 * - 하단 네비게이션 탭 전환 동작 확인
 *
 * TODO: DLD-658 구현 완료 후 test.describe.skip → test.describe 로 변경
 */

test.describe('처리 이력 화면 (/history)', () => {
  // Service Worker의 fetch 이벤트 핸들러가 page.route() 인터셉트를 방해하므로
  // route mock을 사용하는 테스트가 정상 동작하도록 SW를 비활성화합니다.
  test.use({ serviceWorkers: 'block' });

  const createdExternalIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    // 관리자 로그인 (UI 기반)
    await page.goto('/login');
    await page.getByLabel('아이디').fill(TEST_USERS.admin.username);
    await page.getByLabel('비밀번호').fill(TEST_USERS.admin.password);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page).toHaveURL('/requests');
  });

  test.afterAll(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
  });

  // --- happy path ---

  test('이력 페이지에 접근하면 처리된 요청 카드가 렌더링된다 (happy path)', async ({ page }) => {
    // Arrange: 글로벌 시드 데이터의 APPROVED 요청 확인
    const approvedRequest = await findRequestByExternalId('e2e-approved-001');
    expect(approvedRequest).not.toBeNull();

    // Act: 이력 페이지로 이동
    await page.goto('/history');

    // Assert: 페이지 헤더 표시
    await expect(page.getByRole('heading', { name: '처리 이력' })).toBeVisible();
    await expect(page.getByText('최근 처리된 요청')).toBeVisible();

    // Assert: 승인된 요청 카드가 렌더링됨
    const card = page.locator(`[data-request-id="${approvedRequest!.id}"]`);
    await expect(card).toBeVisible();

    // Assert: 카드에 맥락(context), 요청자(requesterName) 표시
    await expect(card.getByText(approvedRequest!.context)).toBeVisible();
    await expect(card.getByText(approvedRequest!.requesterName)).toBeVisible();
  });

  test('승인된 요청 카드에 상태 배지 "승인"이 emerald 색상으로 표시된다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 글로벌 시드 데이터의 APPROVED 요청 사용
    const approvedRequest = await findRequestByExternalId('e2e-approved-001');
    expect(approvedRequest).not.toBeNull();

    // Act: 이력 페이지로 이동
    await page.goto('/history');

    // Assert: 승인 배지가 emerald 색상으로 표시됨
    const card = page.locator(`[data-request-id="${approvedRequest!.id}"]`);
    await expect(card).toBeVisible();

    const approveBadge = card.locator('.bg-emerald-100.text-emerald-700', { hasText: '승인' });
    await expect(approveBadge).toBeVisible();
  });

  test('거절된 요청 카드에 상태 배지 "거절"이 red 색상으로 표시된다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 글로벌 시드 데이터의 REJECTED 요청 사용
    const rejectedRequest = await findRequestByExternalId('e2e-rejected-001');
    expect(rejectedRequest).not.toBeNull();

    // Act: 이력 페이지로 이동
    await page.goto('/history');

    // Assert: 거절 배지가 red 색상으로 표시됨
    const card = page.locator(`[data-request-id="${rejectedRequest!.id}"]`);
    await expect(card).toBeVisible();

    const rejectBadge = card.locator('.bg-red-100.text-red-700', { hasText: '거절' });
    await expect(rejectBadge).toBeVisible();
  });

  test('만료된 요청 카드에 상태 배지 "만료"가 gray 색상으로 표시된다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 만료 상태 테스트 전용 EXPIRED 요청 생성
    const externalId = `e2e-history-expired-${Date.now()}`;
    createdExternalIds.push(externalId);

    const expiredRequest = await createTestRequest({
      externalId,
      context: '이력 화면 만료 배지 확인 테스트용 요청입니다.',
      requesterName: 'E2E Expired Bot',
      status: 'EXPIRED',
      timeoutSeconds: 1,
    });

    // Act: 이력 페이지로 이동
    await page.goto('/history');

    // Assert: 만료 배지가 gray 색상으로 표시됨
    const card = page.locator(`[data-request-id="${expiredRequest.id}"]`);
    await expect(card).toBeVisible();

    const expiredBadge = card.locator('.bg-gray-200.text-gray-500', { hasText: '만료' });
    await expect(expiredBadge).toBeVisible();
  });

  test('이력 카드에 요청 ID가 mono 폰트로 표시된다 (happy path)', async ({ page }) => {
    // Arrange: 글로벌 시드 데이터의 APPROVED 요청 사용
    const approvedRequest = await findRequestByExternalId('e2e-approved-001');
    expect(approvedRequest).not.toBeNull();

    // Act: 이력 페이지로 이동
    await page.goto('/history');

    // Assert: 카드 내 요청 ID가 font-mono 클래스를 가진 요소에 표시됨
    const card = page.locator(`[data-request-id="${approvedRequest!.id}"]`);
    await expect(card).toBeVisible();

    const requestIdEl = card.locator('.font-mono');
    await expect(requestIdEl).toBeVisible();
  });

  test('이력 카드에 처리 시각이 표시된다 (happy path)', async ({ page }) => {
    // Arrange: 처리 시각 확인을 위한 APPROVED 요청 생성
    const externalId = `e2e-history-time-${Date.now()}`;
    createdExternalIds.push(externalId);

    const testRequest = await createTestRequest({
      externalId,
      context: '처리 시각 표시 확인 테스트용 요청입니다.',
      requesterName: 'E2E Time Bot',
      status: 'APPROVED',
    });

    // Act: 이력 페이지로 이동
    await page.goto('/history');

    // Assert: 카드에 처리 시각(날짜/시간 형식 텍스트)이 표시됨
    const card = page.locator(`[data-request-id="${testRequest.id}"]`);
    await expect(card).toBeVisible();

    // 처리 시각은 "YYYY-MM-DD HH:mm" 형식으로 표시됨
    const timeEl = card.locator('span').filter({ hasText: /\d{4}-\d{2}-\d{2}/ });
    await expect(timeEl).toBeVisible();
  });

  // --- edge case ---

  test('처리 이력이 없을 때 빈 상태 UI가 표시된다 (edge case)', async ({ page }) => {
    // Arrange: 이력 API 응답을 빈 배열로 모킹하여 빈 상태 유도
    // NOTE: 구현 시 실제 API 엔드포인트 경로를 확인하여 route 패턴을 조정할 것
    await page.route('**/api/me/requests/history**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, hasMore: false }),
      })
    );

    // Act: 이력 페이지로 이동
    await page.goto('/history');

    // Assert: 빈 상태일 때 "처리 이력이 없습니다" 텍스트가 표시됨
    await expect(page.getByText('처리 이력이 없습니다')).toBeVisible();
  });

  test('더 보기 버튼 또는 무한 스크롤로 이전 이력을 추가 로드한다 (edge case)', async ({
    page,
  }) => {
    // Arrange: 페이지네이션 테스트를 위해 다수의 이력 요청 생성 (기본 페이지 크기 초과)
    const batchExternalIds: string[] = [];
    for (let i = 0; i < 15; i++) {
      const externalId = `e2e-history-page-${Date.now()}-${i}`;
      batchExternalIds.push(externalId);
      createdExternalIds.push(externalId);
    }

    for (let i = 0; i < batchExternalIds.length; i++) {
      await createTestRequest({
        externalId: batchExternalIds[i],
        context: `페이지네이션 테스트용 처리된 요청 - ${batchExternalIds[i]}`,
        requesterName: 'E2E Pagination Bot',
        status: i % 2 === 0 ? 'APPROVED' : 'REJECTED',
      });
    }

    // Act: 이력 페이지로 이동
    await page.goto('/history');
    await expect(page.getByRole('heading', { name: '처리 이력' })).toBeVisible();

    // Assert: "더 보기" 버튼이 표시됨 (무한 스크롤인 경우 스크롤 후 추가 로드 확인)
    const loadMoreButton = page.getByRole('button', { name: '더 보기' });

    if (await loadMoreButton.isVisible()) {
      // "더 보기" 버튼 방식
      const initialCardCount = await page.locator('[data-request-id]').count();

      await loadMoreButton.click();

      // Assert: 카드 수가 증가함
      await expect(async () => {
        const newCardCount = await page.locator('[data-request-id]').count();
        expect(newCardCount).toBeGreaterThan(initialCardCount);
      }).toPass();
    } else {
      // 무한 스크롤 방식: 페이지 하단으로 스크롤
      const initialCardCount = await page.locator('[data-request-id]').count();

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Assert: 스크롤 후 카드 수가 증가함
      await expect(async () => {
        const newCardCount = await page.locator('[data-request-id]').count();
        expect(newCardCount).toBeGreaterThan(initialCardCount);
      }).toPass();
    }
  });

  // --- 네비게이션 ---

  test('이력 페이지에서 하단 네비게이션 "이력" 탭이 active 상태로 표시된다 (happy path)', async ({
    page,
  }) => {
    // Act: 이력 페이지로 이동
    await page.goto('/history');
    await expect(page.getByRole('heading', { name: '처리 이력' })).toBeVisible();

    // Assert: 하단 네비게이션에서 "이력" 탭이 active 상태
    // active 탭은 aria-current="page" 또는 특정 active 클래스로 식별
    const historyNavItem = page.getByRole('link', { name: '이력' });
    await expect(historyNavItem).toBeVisible();
    await expect(historyNavItem).toHaveAttribute('aria-current', 'page');
  });

  test('하단 네비게이션 "대기" 탭을 클릭하면 대기 목록 페이지로 이동한다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 이력 페이지에서 시작
    await page.goto('/history');
    await expect(page.getByRole('heading', { name: '처리 이력' })).toBeVisible();

    // Act: 하단 네비게이션의 "대기" 탭 클릭
    await page.getByRole('link', { name: '대기' }).click();

    // Assert: 대기 목록 페이지(/requests)로 이동
    await expect(page).toHaveURL('/requests');
  });

  test('하단 네비게이션 "설정" 탭을 클릭하면 설정 페이지로 이동한다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 이력 페이지에서 시작
    await page.goto('/history');
    await expect(page.getByRole('heading', { name: '처리 이력' })).toBeVisible();

    // Act: 하단 네비게이션의 "설정" 탭 클릭
    await page.getByRole('link', { name: '설정' }).click();

    // Assert: 설정 페이지(/settings)로 이동
    await expect(page).toHaveURL('/settings');
  });

  // --- error case ---

  test('이력 데이터를 불러오지 못하면 에러 메시지와 재시도 버튼이 표시된다 (error case)', async ({
    page,
  }) => {
    // Arrange: 이력 API 요청을 강제로 실패시킴 (네트워크 인터셉트)
    await page.route('**/api/me/requests/history**', (route) => route.abort('failed'));

    // Act: 이력 페이지로 이동
    await page.goto('/history');

    // Assert: 에러 메시지 표시
    await expect(page.getByText('이력을 불러올 수 없습니다')).toBeVisible();

    // Assert: 재시도 버튼 표시
    await expect(page.getByRole('button', { name: '재시도' })).toBeVisible();

    // Act: 라우트 인터셉트 해제 후 재시도 버튼 클릭
    await page.unroute('**/api/me/requests/history**');
    await page.getByRole('button', { name: '재시도' }).click();

    // Assert: 정상적으로 이력 헤더가 다시 표시됨
    await expect(page.getByRole('heading', { name: '처리 이력' })).toBeVisible();
  });
});
