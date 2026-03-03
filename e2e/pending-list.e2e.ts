import { test, expect } from '@playwright/test';
import { TEST_USERS } from './helpers/auth';
import { cleanupTestData, findRequestByExternalId } from './helpers/db';

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
 */

test.describe('대기 목록 화면 (/requests)', () => {
  test('로그인 후 대기 목록 페이지에 접근하면 PENDING 요청이 카드로 렌더링된다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 로그인
    await page.goto('/login');
    await page.getByLabel('아이디').fill(TEST_USERS.admin.username);
    await page.getByLabel('비밀번호').fill(TEST_USERS.admin.password);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page).toHaveURL('/requests');

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
    // Arrange: 로그인
    await page.goto('/login');
    await page.getByLabel('아이디').fill(TEST_USERS.admin.username);
    await page.getByLabel('비밀번호').fill(TEST_USERS.admin.password);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page).toHaveURL('/requests');

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
    // Arrange: 로그인
    await page.goto('/login');
    await page.getByLabel('아이디').fill(TEST_USERS.admin.username);
    await page.getByLabel('비밀번호').fill(TEST_USERS.admin.password);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page).toHaveURL('/requests');

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
    const createdExternalIds: string[] = [];

    try {
      // Arrange: 빈 상태를 직접 시뮬레이션하기 위해
      // page.route로 /api/requests 응답을 빈 배열로 인터셉트
      await page.route('**/api/me/requests/pending*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ requests: [], count: 0 }),
        });
      });

      // 로그인
      await page.goto('/login');
      await page.getByLabel('아이디').fill(TEST_USERS.admin.username);
      await page.getByLabel('비밀번호').fill(TEST_USERS.admin.password);
      await page.getByRole('button', { name: '로그인' }).click();
      await expect(page).toHaveURL('/requests');

      // Assert: "대기 중인 요청이 없습니다" 텍스트가 표시됨
      await expect(page.getByText('대기 중인 요청이 없습니다')).toBeVisible();
    } finally {
      await cleanupTestData(createdExternalIds);
    }
  });

  test('PENDING 요청 카드를 클릭하면 요청 상세 페이지로 이동한다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 로그인
    await page.goto('/login');
    await page.getByLabel('아이디').fill(TEST_USERS.admin.username);
    await page.getByLabel('비밀번호').fill(TEST_USERS.admin.password);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page).toHaveURL('/requests');

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
