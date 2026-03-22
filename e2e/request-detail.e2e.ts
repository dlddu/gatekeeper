import { test, expect } from '@playwright/test';
import { cleanupTestData, createTestRequest, findRequestByExternalId } from './helpers/db';

/**
 * 요청 상세 및 승인/거절 화면 E2E 테스트
 *
 * DLD-656: 작업 6-1: [요청 상세 및 승인/거절] e2e 테스트 작성 (skipped)
 * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
 *
 * 커버리지:
 * - 요청 상세 페이지 접근 시 맥락(context), 요청자, 남은 시간 표시 확인
 * - 승인 버튼 클릭 → 상태 APPROVED 변경 확인 → 대기 목록(/requests) 복귀 확인
 * - 거절 버튼 클릭 → 상태 REJECTED 변경 확인 → 대기 목록(/requests) 복귀 확인
 * - 이미 처리된 요청(APPROVED/REJECTED) 접근 시 버튼 비활성화 확인
 * - 만료된 요청 접근 시 "만료됨" 표시 및 버튼 비활성화 확인
 *
 * DLD-657: 구현 완료 — test.describe.skip → test.describe 로 변경됨
 */

// DLD-833: 프론트엔드 인증 흐름 제거 전 skip — DLD-834에서 활성화 예정
test.describe.skip('요청 상세 화면 (/requests/:id)', () => {
  const createdExternalIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    // 직접 페이지 접근 (E2E_FORWARD_AUTH_USER 환경변수로 전역 인증 주입)
    await page.goto('/requests');
  });

  test.afterAll(async () => {
    await cleanupTestData(createdExternalIds.splice(0));
  });

  test('PENDING 요청 상세 페이지에 접근하면 맥락, 요청자, 남은 시간이 표시된다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 글로벌 시드 데이터의 타임아웃 있는 PENDING 요청 사용
    const pendingRequest = await findRequestByExternalId('e2e-timeout-001');
    expect(pendingRequest).not.toBeNull();

    // Act: 요청 상세 페이지로 이동
    await page.goto(`/requests/${pendingRequest!.id}`);

    // Assert: 헤더 영역 — "요청 상세" 제목 표시
    await expect(page.getByRole('heading', { name: '요청 상세' })).toBeVisible();

    // Assert: 뒤로가기 버튼 표시
    await expect(page.getByRole('button', { name: '뒤로가기' })).toBeVisible();

    // Assert: 요청자(requesterName) 표시
    await expect(page.getByText(pendingRequest!.requesterName)).toBeVisible();

    // Assert: 맥락(context) 텍스트 표시
    await expect(page.getByText(pendingRequest!.context)).toBeVisible();

    // Assert: 타임아웃 있는 요청이므로 amber 배경의 카운트다운 타이머 표시
    const timerEl = page.locator('.bg-amber-50, .bg-amber-100, [class*="amber"]').first();
    await expect(timerEl).toBeVisible();
  });

  test('PENDING 요청에서 승인 클릭하면 상태가 APPROVED로 변경되고 대기 목록으로 복귀한다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 승인 테스트 전용 PENDING 요청 생성
    const externalId = `e2e-detail-approve-${Date.now()}`;
    createdExternalIds.push(externalId);

    const testRequest = await createTestRequest({
      externalId,
      context: '상세 화면 승인 테스트용 배포 요청입니다.',
      requesterName: 'E2E Deploy Bot',
      status: 'PENDING',
    });

    // Act: 요청 상세 페이지로 이동
    await page.goto(`/requests/${testRequest.id}`);
    await expect(page.getByRole('heading', { name: '요청 상세' })).toBeVisible();

    // Act: 승인 버튼 클릭
    await page.getByRole('button', { name: '승인' }).click();

    // Act: 확인 다이얼로그에서 확인 클릭
    await page.getByRole('button', { name: '확인' }).click();

    // Assert: 대기 목록(/requests)으로 복귀
    await expect(page).toHaveURL('/requests');

    // Assert: DB에서 상태가 APPROVED로 변경됐는지 확인
    const updatedRequest = await findRequestByExternalId(externalId);
    expect(updatedRequest).not.toBeNull();
    expect(updatedRequest!.status).toBe('APPROVED');
  });

  test('PENDING 요청에서 거절 클릭하면 상태가 REJECTED로 변경되고 대기 목록으로 복귀한다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 거절 테스트 전용 PENDING 요청 생성
    const externalId = `e2e-detail-reject-${Date.now()}`;
    createdExternalIds.push(externalId);

    const testRequest = await createTestRequest({
      externalId,
      context: '상세 화면 거절 테스트용 배포 요청입니다.',
      requesterName: 'E2E Deploy Bot',
      status: 'PENDING',
    });

    // Act: 요청 상세 페이지로 이동
    await page.goto(`/requests/${testRequest.id}`);
    await expect(page.getByRole('heading', { name: '요청 상세' })).toBeVisible();

    // Act: 거절 버튼 클릭
    await page.getByRole('button', { name: '거절' }).click();

    // Act: 확인 다이얼로그에서 확인 클릭
    await page.getByRole('button', { name: '확인' }).click();

    // Assert: 대기 목록(/requests)으로 복귀
    await expect(page).toHaveURL('/requests');

    // Assert: DB에서 상태가 REJECTED로 변경됐는지 확인
    const updatedRequest = await findRequestByExternalId(externalId);
    expect(updatedRequest).not.toBeNull();
    expect(updatedRequest!.status).toBe('REJECTED');
  });

  test('이미 처리된 요청 상세 페이지에서는 승인/거절 버튼이 비활성화된다 (edge case)', async ({
    page,
  }) => {
    // Arrange: 글로벌 시드 데이터의 APPROVED 요청 사용
    const approvedRequest = await findRequestByExternalId('e2e-approved-001');
    expect(approvedRequest).not.toBeNull();

    // Act: 이미 처리된 요청 상세 페이지로 이동
    await page.goto(`/requests/${approvedRequest!.id}`);
    await expect(page.getByRole('heading', { name: '요청 상세' })).toBeVisible();

    // Assert: 승인 버튼이 비활성화(disabled) 상태
    const approveButton = page.getByRole('button', { name: '승인' });
    await expect(approveButton).toBeDisabled();

    // Assert: 거절 버튼이 비활성화(disabled) 상태
    const rejectButton = page.getByRole('button', { name: '거절' });
    await expect(rejectButton).toBeDisabled();

    // Arrange: 글로벌 시드 데이터의 REJECTED 요청도 동일하게 검증
    const rejectedRequest = await findRequestByExternalId('e2e-rejected-001');
    expect(rejectedRequest).not.toBeNull();

    await page.goto(`/requests/${rejectedRequest!.id}`);
    await expect(page.getByRole('heading', { name: '요청 상세' })).toBeVisible();

    await expect(page.getByRole('button', { name: '승인' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '거절' })).toBeDisabled();
  });

  test('만료된 요청 상세 페이지에서는 "만료됨"이 표시되고 버튼이 비활성화된다 (edge case)', async ({
    page,
  }) => {
    // Arrange: 만료 상태 테스트 전용 EXPIRED 요청 생성
    const externalId = `e2e-detail-expired-${Date.now()}`;
    createdExternalIds.push(externalId);

    const expiredRequest = await createTestRequest({
      externalId,
      context: '만료 상태 확인 테스트용 요청입니다.',
      requesterName: 'E2E Expired Bot',
      status: 'EXPIRED',
      timeoutSeconds: 1,
    });

    // Act: 만료된 요청 상세 페이지로 이동
    await page.goto(`/requests/${expiredRequest.id}`);
    await expect(page.getByRole('heading', { name: '요청 상세' })).toBeVisible();

    // Assert: "만료됨" 텍스트가 표시됨
    await expect(page.getByText('만료됨')).toBeVisible();

    // Assert: 타이머 영역에 만료 표시 (amber 배경이 아닌 gray 계열)
    const timerEl = page.locator('.bg-gray-50, .bg-gray-100, [class*="gray"]').first();
    await expect(timerEl).toBeVisible();

    // Assert: 승인 버튼이 비활성화(disabled) 상태
    const approveButton = page.getByRole('button', { name: '승인' });
    await expect(approveButton).toBeDisabled();

    // Assert: 거절 버튼이 비활성화(disabled) 상태
    const rejectButton = page.getByRole('button', { name: '거절' });
    await expect(rejectButton).toBeDisabled();
  });
});
