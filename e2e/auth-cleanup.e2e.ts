import { test, expect } from '@playwright/test';
import { TEST_USERS } from './helpers/auth';

/**
 * [기존 인증 정리] E2E 테스트
 *
 * DLD-800: 작업 5-1: [기존 인증 정리] e2e 테스트 작성 (skipped)
 * DLD-801: 작업 5-2: [기존 인증 정리] 구현 및 e2e 테스트 활성화 (후행 이슈)
 * 부모 이슈: DLD-791 (Gatekeeper — OIDC 로그인 (Authentik))
 *
 * 커버리지:
 * - POST /api/auth/signup 엔드포인트 제거 확인 (404)
 * - POST /api/auth/login 기존 동작 유지 확인 (200 + JWT)
 * - POST /api/auth/login OIDC 전용 사용자 차단 확인 (401)
 * - /api/auth/signup publicPaths 제거 확인 (미들웨어 간접 검증)
 *
 * TODO: DLD-801 구현 완료 후 test.describe.skip → test.describe 로 변경
 */

// TODO: Activate when DLD-801 is implemented
test.describe.skip('POST /api/auth/signup 제거 확인', () => {
  test('signup 엔드포인트가 제거되어 404를 반환한다 (happy path)', async ({ request }) => {
    // 구현 전 - DLD-801에서 활성화 예정
    // Act: signup 엔드포인트 호출
    const response = await request.post('/api/auth/signup', {
      data: {
        username: 'e2e-cleanup-test',
        password: 'testpass123',
        displayName: 'Cleanup Test User',
      },
    });

    // Assert: 엔드포인트가 제거되어 404 응답
    expect(response.status()).toBe(404);
  });
});

// TODO: Activate when DLD-801 is implemented
test.describe.skip('POST /api/auth/login 기존 동작 유지 확인', () => {
  test('올바른 자격증명으로 로그인하면 200과 JWT 토큰을 반환한다 (happy path)', async ({
    request,
  }) => {
    // 구현 전 - DLD-801에서 활성화 예정
    // Act: 기존 password 사용자로 로그인
    const response = await request.post('/api/auth/login', {
      data: {
        username: TEST_USERS.admin.username,
        password: TEST_USERS.admin.password,
      },
    });

    // Assert: 기존 login API는 정상 동작 유지
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('token');
    expect(typeof body.token).toBe('string');
    expect(body.token.split('.')).toHaveLength(3); // JWT 형식 검증
    expect(body).toHaveProperty('userId');
    expect(body).toHaveProperty('username', TEST_USERS.admin.username);
  });
});

// TODO: Activate when DLD-801 is implemented
test.describe.skip('POST /api/auth/login OIDC 전용 사용자 차단 확인', () => {
  test('passwordHash가 없는 OIDC 전용 사용자로 로그인 시도하면 401을 반환한다 (error case)', async ({
    request,
  }) => {
    // 구현 전 - DLD-801에서 활성화 예정
    // Arrange: global-setup.ts에서 시드된 OIDC 전용 사용자 (passwordHash 없음)
    // oidc-user: { username: 'oidc-user', oidcSub: 'test-oidc-sub-001', passwordHash: null }

    // Act: OIDC 전용 사용자로 password 로그인 시도
    const response = await request.post('/api/auth/login', {
      data: {
        username: 'oidc-user',
        password: 'any-password',
      },
    });

    // Assert: passwordHash 없는 OIDC 계정이므로 401 차단
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});

// TODO: Activate when DLD-801 is implemented
test.describe.skip('/api/auth/signup publicPaths 제거 확인 (미들웨어)', () => {
  test('/api/auth/signup가 publicPaths에서 제거되어 404를 반환한다 (edge case)', async ({
    request,
  }) => {
    // 구현 전 - DLD-801에서 활성화 예정
    //
    // 검증 의도:
    // signup 엔드포인트가 제거된 후, /api/auth/signup 경로는 존재하지 않으므로
    // 미들웨어의 publicPaths에서도 제거되어야 합니다.
    // signup 경로가 publicPaths에 남아 있더라도 실제 라우트 핸들러가 없으면 404이므로,
    // 이 테스트는 토큰 없이 요청했을 때 미들웨어가 401(보호 경로)이 아닌
    // 404(없는 경로)를 반환함을 확인합니다.
    //
    // 즉: signup 제거 → 404 (미들웨어 차단 401이 아님)

    // Act: 인증 헤더 없이 signup 경로 접근
    const response = await request.post('/api/auth/signup', {
      data: {},
    });

    // Assert: 존재하지 않는 라우트이므로 404 (미들웨어의 401이 아님)
    expect(response.status()).toBe(404);
    expect(response.status()).not.toBe(401);
  });
});
