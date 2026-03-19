import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * OIDC 로그인 UI 플로우 E2E 테스트
 *
 * DLD-798: 작업 4-1: [OIDC 로그인 UI] e2e 테스트 작성 (skipped)
 * DLD-799: 작업 4-2: [OIDC 로그인 UI] 구현 및 e2e 테스트 활성화 (후행 이슈)
 * 부모 이슈: DLD-791 (Gatekeeper — OIDC 로그인 (Authentik))
 *
 * 커버리지:
 * - /login 페이지에서 '로그인' 버튼 클릭 → OIDC 인증 시작 → /requests 도달 (happy path)
 * - /login?error=auth_failed 접속 시 에러 메시지 표시
 * - localStorage에 유효한 토큰이 있을 때 /login 접속 시 /requests로 자동 리다이렉트
 * - /login/callback 접속 시 토큰 없으면 에러 표시 + 로그인 페이지 복귀 링크
 *
 * 환경:
 * - OIDC Mock 서버: http://localhost:9999 (global-setup.ts에서 기동)
 * - OIDC_ISSUER: http://localhost:9999
 * - OIDC_CLIENT_ID: test-client
 * - OIDC_REDIRECT_URI: http://localhost:3001/api/auth/oidc/callback
 *
 * TODO: DLD-799 구현 완료 후 test.describe.skip → test.describe 로 변경
 */

test.describe('OIDC 로그인 UI 플로우', () => {
  test('/login 페이지에서 로그인 버튼 클릭 시 OIDC 인증을 거쳐 /requests에 도달한다 (happy path)', async ({
    page,
  }) => {
    // Act: /login 접속 후 '로그인' 버튼 클릭
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Gatekeeper' })).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();

    // 버튼 클릭 시 /api/auth/oidc/authorize → mock OIDC Provider → /api/auth/oidc/callback → /login/callback?token=JWT 흐름 진행
    await page.getByRole('button', { name: '로그인' }).click();

    // Assert: 전체 OIDC 플로우를 거쳐 /requests에 도달해야 함
    await expect(page).toHaveURL('/requests');
  });

  test('/login?error=auth_failed 접속 시 에러 메시지가 표시된다 (error case)', async ({
    page,
  }) => {
    // Act: 에러 쿼리 파라미터와 함께 /login 접속
    await page.goto('/login?error=auth_failed');

    // Assert: 에러 메시지 박스가 표시되어야 함
    await expect(
      page.getByText('로그인에 실패했습니다. 다시 시도해 주세요.')
    ).toBeVisible();

    // Assert: 로그인 버튼은 여전히 활성화 상태여야 함 (재시도 가능)
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeEnabled();
  });

  test('localStorage에 유효한 토큰이 있으면 /login 접속 시 /requests로 자동 리다이렉트된다 (edge case)', async ({
    page,
    request,
  }) => {
    // Arrange: API를 통해 유효한 JWT 토큰 획득
    const { token } = await loginAsAdmin(request);

    // localStorage에 토큰 저장 후 /login 접속
    await page.goto('/login');
    await page.evaluate((jwt) => {
      localStorage.setItem('token', jwt);
    }, token);

    // 토큰이 있는 상태에서 /login 재접속
    await page.goto('/login');

    // Assert: 이미 인증된 상태이므로 /requests로 자동 리다이렉트
    await expect(page).toHaveURL('/requests');
  });

  test('/login/callback 접속 시 토큰 파라미터가 없으면 에러를 표시하고 로그인 페이지 복귀 링크를 제공한다 (error case)', async ({
    page,
  }) => {
    // Act: 토큰 없이 /login/callback 직접 접속
    await page.goto('/login/callback');

    // Assert: 에러 메시지가 표시되어야 함
    await expect(page.getByText('인증 처리에 실패했습니다.')).toBeVisible();

    // Assert: 로그인 페이지 복귀 링크가 있어야 함
    const backLink = page.getByRole('link', { name: '로그인 페이지로 돌아가기' });
    await expect(backLink).toBeVisible();

    // Assert: 링크가 /login을 가리켜야 함
    await expect(backLink).toHaveAttribute('href', '/login');
  });
});
