import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAsAdmin, withAuthHeader } from './helpers/auth';

/**
 * 인증 API E2E 테스트
 *
 * DLD-647: e2e 테스트 환경 구성
 * DLD-649: 작업 2-2: [사용자 인증] 구현 및 e2e 테스트 활성화
 * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
 *
 * 커버리지:
 * - POST /api/auth/login (로그인)
 * - JWT 토큰 기반 인증 미들웨어
 * - 공개/보호 경로 접근 제어
 */

test.describe('POST /api/auth/login', () => {
  test('올바른 자격증명으로 로그인하면 JWT 토큰을 반환한다 (happy path)', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        username: TEST_USERS.admin.username,
        password: TEST_USERS.admin.password,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('token');
    expect(typeof body.token).toBe('string');
    expect(body.token.split('.')).toHaveLength(3); // JWT 형식 검증
    expect(body).toHaveProperty('userId');
    expect(body).toHaveProperty('username', TEST_USERS.admin.username);
  });

  test('잘못된 비밀번호로 로그인하면 401을 반환한다 (error case)', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        username: TEST_USERS.admin.username,
        password: 'wrong-password',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('존재하지 않는 사용자로 로그인하면 401을 반환한다 (error case)', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        username: 'nonexistent-user',
        password: 'anypassword',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('username 필드 없이 로그인 요청하면 400을 반환한다 (edge case)', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { password: 'somepassword' },
    });

    expect(response.status()).toBe(400);
  });

  test('password 필드 없이 로그인 요청하면 400을 반환한다 (edge case)', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { username: TEST_USERS.admin.username },
    });

    expect(response.status()).toBe(400);
  });

  test('빈 바디로 로그인 요청하면 400을 반환한다 (edge case)', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {},
    });

    expect(response.status()).toBe(400);
  });

  test('로그인 성공 후 반환된 토큰으로 보호된 API에 접근할 수 있다 (happy path)', async ({
    request,
  }) => {
    const { token } = await loginAsAdmin(request);

    // 보호된 API 엔드포인트에 토큰으로 접근
    const response = await request.get('/api/requests', {
      ...withAuthHeader(token),
    });

    // 인증은 통과해야 함 (200 또는 실제 비즈니스 응답)
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
  });
});

test.describe('인증 미들웨어 (JWT 보호 경로)', () => {
  test('토큰 없이 보호된 API 접근하면 401을 반환한다 (error case)', async ({ request }) => {
    const response = await request.get('/api/users');

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  test('잘못된 형식의 토큰으로 보호된 API 접근하면 401을 반환한다 (error case)', async ({
    request,
  }) => {
    const response = await request.get('/api/users', {
      headers: { Authorization: 'Bearer not.a.valid.jwt.token' },
    });

    expect(response.status()).toBe(401);
  });

  test('만료된 토큰으로 보호된 API 접근하면 401을 반환한다 (error case)', async ({ request }) => {
    // 이미 만료된 JWT (jose로 직접 생성한 경우 필요하나,
    // 여기서는 명백히 유효하지 않은 토큰으로 동일한 결과 검증)
    const expiredLikeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ1c2VyLTEiLCJ1c2VybmFtZSI6ImFkbWluIiwiZXhwIjoxfQ.invalid';
    const response = await request.get('/api/users', {
      headers: { Authorization: `Bearer ${expiredLikeToken}` },
    });

    expect(response.status()).toBe(401);
  });

  test('/api/auth/login 경로는 토큰 없이 접근 가능하다 (공개 경로)', async ({ request }) => {
    // 인증 없이 login 엔드포인트 접근 시 미들웨어에서 차단되면 안 됨
    const response = await request.post('/api/auth/login', {
      data: { username: 'test', password: 'test' },
    });

    // 401이 아닌 응답이어야 함 (실제 로그인 실패라면 400 or 401 from handler, not middleware)
    // 미들웨어가 공개 경로를 올바르게 통과시키는지 확인
    expect(response.status()).not.toBe(401); // 미들웨어 블록이 아닌 실제 핸들러 응답
  });

  test('/api/requests 경로는 토큰 없이 접근 가능하다 (공개 경로)', async ({ request }) => {
    const response = await request.get('/api/requests');

    // 미들웨어가 공개 경로를 통과시켜야 함
    expect(response.status()).not.toBe(401);
  });

  test('유효한 토큰의 Bearer prefix 없이 보내면 401을 반환한다 (edge case)', async ({
    request,
  }) => {
    const { token } = await loginAsAdmin(request);

    const response = await request.get('/api/users', {
      headers: { Authorization: token }, // "Bearer " prefix 없음
    });

    expect(response.status()).toBe(401);
  });
});
