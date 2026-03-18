import { test, expect } from '@playwright/test';
import { createTestPrismaClient, deleteTestUser } from './helpers/db';

/**
 * OIDC 인증 플로우 E2E 테스트
 *
 * DLD-796: 작업 3-1: [OIDC 인증 플로우] e2e 테스트 작성 (skipped)
 * DLD-797: 작업 3-2: [OIDC 인증 플로우] 구현 및 e2e 테스트 활성화 (후행 이슈)
 * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
 *
 * 커버리지:
 * - GET /api/auth/oidc/authorize (Authentik으로 리다이렉트)
 * - GET /api/auth/oidc/callback (Authorization Code 교환 + JWT 발급)
 *   - 신규 사용자 auto-provisioning
 *   - 기존 OIDC 사용자 재로그인 (중복 생성 방지)
 *   - state 검증 실패
 *   - 잘못된 code로 토큰 교환 실패
 *   - state 쿠키 없이 callback 호출
 *
 * 환경:
 * - OIDC Mock 서버: http://localhost:9999 (global-setup.ts에서 기동)
 * - OIDC_ISSUER: http://localhost:9999
 * - OIDC_CLIENT_ID: test-client
 * - OIDC_REDIRECT_URI: http://localhost:3000/api/auth/oidc/callback
 *
 * TODO: DLD-797 구현 완료 후 test.describe.skip → test.describe 로 변경
 */

// global-setup.ts의 seedDatabase()에서 생성된 OIDC 시드 사용자
const OIDC_SEED_USER = {
  username: 'oidc-user',
  oidcSub: 'test-oidc-sub-001',
  displayName: 'OIDC Test User',
} as const;

// TODO: Activate when DLD-797 is implemented
test.describe('GET /api/auth/oidc/authorize (OIDC 인증 시작)', () => {
  test('/api/auth/oidc/authorize 호출 시 mock Authentik으로 302 리다이렉트된다 (happy path)', async ({
    request,
  }) => {
    // Act: OIDC 인증 시작 엔드포인트 호출 (리다이렉트 미추적)
    const response = await request.get('/api/auth/oidc/authorize', {
      maxRedirects: 0,
    });

    // Assert: mock Authentik(/authorize)으로 302 리다이렉트
    expect(response.status()).toBe(302);

    const location = response.headers()['location'];
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location);
    expect(redirectUrl.origin).toBe('http://localhost:9999');
    expect(redirectUrl.pathname).toBe('/authorize');
  });

  test('리다이렉트 URL에 필수 OIDC 파라미터가 포함된다 (happy path)', async ({
    request,
  }) => {
    // Act
    const response = await request.get('/api/auth/oidc/authorize', {
      maxRedirects: 0,
    });

    // Assert: redirect URL에 OIDC 필수 파라미터 포함 확인
    const location = response.headers()['location'];
    const redirectUrl = new URL(location);

    expect(redirectUrl.searchParams.get('client_id')).toBe('test-client');
    expect(redirectUrl.searchParams.get('redirect_uri')).toBeTruthy();
    expect(redirectUrl.searchParams.get('response_type')).toBe('code');
    expect(redirectUrl.searchParams.get('state')).toBeTruthy();
    expect(redirectUrl.searchParams.get('nonce')).toBeTruthy();
  });

  test('/api/auth/oidc/authorize 호출 후 state와 nonce 쿠키가 설정된다 (happy path)', async ({
    request,
  }) => {
    // Act
    const response = await request.get('/api/auth/oidc/authorize', {
      maxRedirects: 0,
    });

    // Assert: httpOnly state/nonce 쿠키 설정 확인
    const setCookieHeader = response.headers()['set-cookie'];
    expect(setCookieHeader).toBeTruthy();

    // state 쿠키 존재 확인
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader.split('\n');
    const stateCookie = cookies.find((c: string) => c.startsWith('oidc_state='));
    const nonceCookie = cookies.find((c: string) => c.startsWith('oidc_nonce='));

    expect(stateCookie).toBeTruthy();
    expect(nonceCookie).toBeTruthy();

    // httpOnly, SameSite=Lax 속성 확인
    expect(stateCookie).toMatch(/HttpOnly/i);
    expect(stateCookie).toMatch(/SameSite=Lax/i);
    expect(nonceCookie).toMatch(/HttpOnly/i);
    expect(nonceCookie).toMatch(/SameSite=Lax/i);
  });
});

// TODO: Activate when DLD-797 is implemented
test.describe('GET /api/auth/oidc/callback (신규 사용자 auto-provisioning)', () => {
  // 테스트에서 생성된 사용자를 정리하기 위한 추적 목록
  const provisionedUsernames: string[] = [];

  test.afterEach(async () => {
    // 테스트에서 auto-provisioning된 사용자 정리
    for (const username of provisionedUsernames.splice(0)) {
      await deleteTestUser(username);
    }
  });

  test('유효한 code와 state로 callback 호출 시 신규 User가 auto-provisioning된다 (happy path)', async ({
    request,
  }) => {
    // Arrange: authorize 호출로 state/nonce 쿠키 획득 + mock Authentik에서 code 발급
    const authorizeResponse = await request.get('/api/auth/oidc/authorize', {
      maxRedirects: 0,
    });
    expect(authorizeResponse.status()).toBe(302);

    const authorizeLocation = authorizeResponse.headers()['location'];
    const authorizeUrl = new URL(authorizeLocation);
    const state = authorizeUrl.searchParams.get('state')!;

    // mock Authentik /authorize 호출로 code 획득 (302 redirect to callback)
    const mockAuthorizeResponse = await request.get(authorizeLocation, {
      maxRedirects: 0,
    });
    expect(mockAuthorizeResponse.status()).toBe(302);

    const callbackLocation = mockAuthorizeResponse.headers()['location'];
    const callbackUrl = new URL(callbackLocation);
    const code = callbackUrl.searchParams.get('code')!;

    expect(code).toBeTruthy();
    expect(callbackUrl.searchParams.get('state')).toBe(state);

    // Act: callback 호출 (state 쿠키는 authorizeResponse에서 자동 설정됨)
    const callbackResponse = await request.get(
      `/api/auth/oidc/callback?code=${code}&state=${state}`,
      { maxRedirects: 0 }
    );

    // Assert: /login/callback?token=JWT 로 302 리다이렉트
    expect(callbackResponse.status()).toBe(302);

    const callbackRedirect = callbackResponse.headers()['location'];
    expect(callbackRedirect).toBeTruthy();

    const redirectUrl = new URL(callbackRedirect, 'http://localhost:3001');
    expect(redirectUrl.pathname).toBe('/login/callback');

    const token = redirectUrl.searchParams.get('token');
    expect(token).toBeTruthy();
    expect(token!.split('.')).toHaveLength(3); // JWT 형식 검증

    // Assert: DB에 신규 User가 생성됨
    const prisma = await createTestPrismaClient();
    try {
      // id_token의 sub 클레임으로 사용자 조회
      // (mock 서버는 랜덤 UUID를 sub로 발급하므로, token을 디코딩하여 userId 추출)
      const [, payloadB64] = token!.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      expect(user).not.toBeNull();
      expect(user!.oidcSub).toBeTruthy();
      expect(user!.passwordHash).toBeNull(); // OIDC 전용 사용자

      if (user!.username) {
        provisionedUsernames.push(user!.username);
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  test('callback 후 반환된 JWT로 보호된 API에 접근할 수 있다 (happy path)', async ({
    request,
  }) => {
    // Arrange: OIDC 플로우 전체 실행하여 JWT 획득
    const authorizeResponse = await request.get('/api/auth/oidc/authorize', {
      maxRedirects: 0,
    });
    const authorizeLocation = authorizeResponse.headers()['location'];
    const state = new URL(authorizeLocation).searchParams.get('state')!;

    const mockAuthorizeResponse = await request.get(authorizeLocation, {
      maxRedirects: 0,
    });
    const callbackLocation = mockAuthorizeResponse.headers()['location'];
    const callbackUrl = new URL(callbackLocation);
    const code = callbackUrl.searchParams.get('code')!;

    const callbackResponse = await request.get(
      `/api/auth/oidc/callback?code=${code}&state=${state}`,
      { maxRedirects: 0 }
    );

    const redirectUrl = new URL(
      callbackResponse.headers()['location'],
      'http://localhost:3001'
    );
    const token = redirectUrl.searchParams.get('token')!;

    // 사용자 정리를 위한 username 추적
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    const prisma = await createTestPrismaClient();
    try {
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (user?.username) {
        provisionedUsernames.push(user.username);
      }
    } finally {
      await prisma.$disconnect();
    }

    // Act: 획득한 JWT로 보호된 API 접근
    const apiResponse = await request.get('/api/requests', {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Assert: 인증 통과 (401/403이 아닌 응답)
    expect(apiResponse.status()).not.toBe(401);
    expect(apiResponse.status()).not.toBe(403);
  });
});

// TODO: Activate when DLD-797 is implemented
test.describe('GET /api/auth/oidc/callback (기존 OIDC 사용자 재로그인)', () => {
  test('기존 OIDC 사용자(같은 oidcSub)로 재로그인 시 User 중복 생성 없이 기존 User의 JWT를 반환한다 (happy path)', async ({
    request,
  }) => {
    /**
     * 이 테스트는 global-setup.ts에서 시드된 기존 OIDC 사용자를 활용합니다.
     * 단, mock 서버는 랜덤 UUID sub를 발급하므로, 기존 oidcSub('test-oidc-sub-001')와
     * 일치하는 id_token을 얻으려면 mock 서버가 고정 sub를 지원하거나,
     * 혹은 서버가 기존 사용자를 username 기반으로 조회하는 방식에 따라
     * 테스트 구현이 달라질 수 있습니다.
     *
     * DLD-797 구현 시: mock 서버의 sub 고정 방식 또는 별도 파라미터를 통해
     * 기존 oidcSub('test-oidc-sub-001')를 가진 id_token이 발급되도록 조정하세요.
     */

    // Arrange: 재로그인 전 DB의 사용자 수 기록
    const prisma = await createTestPrismaClient();
    let userCountBefore: number;
    let existingUser: { id: string; username: string; oidcSub: string | null } | null;

    try {
      existingUser = await prisma.user.findUnique({
        where: { username: OIDC_SEED_USER.username },
        select: { id: true, username: true, oidcSub: true },
      });
      expect(existingUser).not.toBeNull();
      expect(existingUser!.oidcSub).toBe(OIDC_SEED_USER.oidcSub);

      userCountBefore = await prisma.user.count();
    } finally {
      await prisma.$disconnect();
    }

    // Act: OIDC 플로우 실행 (기존 oidcSub를 가진 id_token이 발급된다고 가정)
    const authorizeResponse = await request.get('/api/auth/oidc/authorize', {
      maxRedirects: 0,
    });
    const authorizeLocation = authorizeResponse.headers()['location'];
    const state = new URL(authorizeLocation).searchParams.get('state')!;

    // mock Authentik에 고정 sub를 전달하여 기존 사용자의 oidcSub와 일치하는 id_token 발급
    const mockAuthorizeUrl = `${authorizeLocation}&sub=${OIDC_SEED_USER.oidcSub}`;
    const mockAuthorizeResponse = await request.get(mockAuthorizeUrl, {
      maxRedirects: 0,
    });
    const callbackLocation = mockAuthorizeResponse.headers()['location'];
    const code = new URL(callbackLocation).searchParams.get('code')!;

    const callbackResponse = await request.get(
      `/api/auth/oidc/callback?code=${code}&state=${state}`,
      { maxRedirects: 0 }
    );

    // Assert: /login/callback?token=JWT 리다이렉트
    expect(callbackResponse.status()).toBe(302);
    const redirectUrl = new URL(
      callbackResponse.headers()['location'],
      'http://localhost:3001'
    );
    const token = redirectUrl.searchParams.get('token');
    expect(token).toBeTruthy();

    // Assert: DB 사용자 수 변화 없음 (중복 생성 안 됨)
    const prisma2 = await createTestPrismaClient();
    try {
      const userCountAfter = await prisma2.user.count();
      expect(userCountAfter).toBe(userCountBefore);

      // Assert: 반환된 JWT의 userId가 기존 사용자 ID와 일치
      const [, payloadB64] = token!.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
      expect(payload.userId).toBe(existingUser!.id);
    } finally {
      await prisma2.$disconnect();
    }
  });
});

// TODO: Activate when DLD-797 is implemented
test.describe('GET /api/auth/oidc/callback (보안 검증)', () => {
  test('잘못된 state 파라미터로 callback 호출 시 에러 응답을 반환한다 (security)', async ({
    request,
  }) => {
    // Arrange: 정상적인 authorize 호출로 state 쿠키만 설정
    await request.get('/api/auth/oidc/authorize', { maxRedirects: 0 });

    // Act: 쿠키의 state와 다른 state 값으로 callback 호출
    const invalidState = 'tampered-state-value-that-does-not-match-cookie';
    const response = await request.get(
      `/api/auth/oidc/callback?code=any-code&state=${invalidState}`,
      { maxRedirects: 0 }
    );

    // Assert: 4xx 에러 응답 (state 불일치)
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });

  test('잘못된 code로 callback 호출 시 토큰 교환 실패 에러를 반환한다 (security)', async ({
    request,
  }) => {
    // Arrange: 정상적인 authorize 호출로 state 쿠키 획득
    const authorizeResponse = await request.get('/api/auth/oidc/authorize', {
      maxRedirects: 0,
    });
    const authorizeLocation = authorizeResponse.headers()['location'];
    const state = new URL(authorizeLocation).searchParams.get('state')!;

    // Act: 유효하지 않은 code로 callback 호출 (mock 서버에 등록되지 않은 code)
    const invalidCode = 'invalid-authorization-code-not-issued-by-mock';
    const response = await request.get(
      `/api/auth/oidc/callback?code=${invalidCode}&state=${state}`,
      { maxRedirects: 0 }
    );

    // Assert: 4xx 에러 응답 (mock 서버에서 invalid_grant 반환)
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });

  test('state 쿠키 없이 callback 호출 시 에러 응답을 반환한다 (security)', async ({
    request,
  }) => {
    // Act: state 쿠키 없이 (authorize를 거치지 않고) 직접 callback 호출
    // 쿠키를 포함하지 않는 새 요청 컨텍스트를 사용
    const response = await request.get(
      '/api/auth/oidc/callback?code=some-code&state=some-state',
      {
        maxRedirects: 0,
        headers: {
          // 쿠키 헤더 명시적 제거 (빈 값으로 덮어쓰기)
          Cookie: '',
        },
      }
    );

    // Assert: 4xx 에러 응답 (state 쿠키 없음)
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });
});
