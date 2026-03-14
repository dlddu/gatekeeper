import { test, expect } from '@playwright/test';
import { withAuthHeader } from './helpers/auth';
import { deleteTestUser } from './helpers/db';

/**
 * 회원가입 API E2E 테스트
 *
 * 커버리지:
 * - POST /api/auth/signup (회원가입)
 * - 필수 필드 검증
 * - 중복 username 처리
 * - 회원가입 후 JWT 토큰 발급 및 인증 확인
 */

// 테스트에서 생성한 사용자 목록 (cleanup용)
const createdUsernames: string[] = [];

test.afterEach(async () => {
  // 각 테스트에서 생성한 사용자 정리
  for (const username of createdUsernames.splice(0)) {
    await deleteTestUser(username);
  }
});

test.describe('POST /api/auth/signup', () => {
  test('올바른 정보로 회원가입하면 201과 JWT 토큰을 반환한다 (happy path)', async ({ request }) => {
    const username = `e2e-signup-${Date.now()}`;
    createdUsernames.push(username);

    const response = await request.post('/api/auth/signup', {
      data: {
        username,
        password: 'testpass123',
        displayName: 'E2E Signup User',
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('token');
    expect(typeof body.token).toBe('string');
    expect(body.token.split('.')).toHaveLength(3); // JWT 형식 검증
    expect(body).toHaveProperty('userId');
    expect(typeof body.userId).toBe('string');
    expect(body).toHaveProperty('username', username);
  });

  test('회원가입 후 반환된 토큰으로 보호된 API에 접근할 수 있다 (happy path)', async ({
    request,
  }) => {
    const username = `e2e-signup-auth-${Date.now()}`;
    createdUsernames.push(username);

    const signupResponse = await request.post('/api/auth/signup', {
      data: {
        username,
        password: 'testpass123',
        displayName: 'E2E Auth Test User',
      },
    });

    expect(signupResponse.status()).toBe(201);
    const { token } = await signupResponse.json();

    // 보호된 API 엔드포인트에 토큰으로 접근
    const protectedResponse = await request.get(
      '/api/me/requests/pending',
      withAuthHeader(token)
    );

    expect(protectedResponse.status()).not.toBe(401);
    expect(protectedResponse.status()).not.toBe(403);
  });

  test('회원가입 후 동일한 자격증명으로 로그인할 수 있다 (happy path)', async ({ request }) => {
    const username = `e2e-signup-login-${Date.now()}`;
    const password = 'testpass123';
    createdUsernames.push(username);

    // 회원가입
    const signupResponse = await request.post('/api/auth/signup', {
      data: {
        username,
        password,
        displayName: 'E2E Login Test User',
      },
    });
    expect(signupResponse.status()).toBe(201);

    // 동일한 자격증명으로 로그인
    const loginResponse = await request.post('/api/auth/login', {
      data: { username, password },
    });

    expect(loginResponse.status()).toBe(200);

    const loginBody = await loginResponse.json();
    expect(loginBody).toHaveProperty('token');
    expect(loginBody).toHaveProperty('username', username);
  });

  test('이미 존재하는 username으로 회원가입하면 409를 반환한다 (error case)', async ({
    request,
  }) => {
    const username = `e2e-signup-dup-${Date.now()}`;
    createdUsernames.push(username);

    // 첫 번째 회원가입
    const firstResponse = await request.post('/api/auth/signup', {
      data: {
        username,
        password: 'testpass123',
        displayName: 'First User',
      },
    });
    expect(firstResponse.status()).toBe(201);

    // 동일한 username으로 두 번째 회원가입
    const secondResponse = await request.post('/api/auth/signup', {
      data: {
        username,
        password: 'differentpass',
        displayName: 'Second User',
      },
    });

    expect(secondResponse.status()).toBe(409);

    const body = await secondResponse.json();
    expect(body).toHaveProperty('error');
  });

  test('username 필드 없이 요청하면 400을 반환한다 (edge case)', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: { password: 'testpass123', displayName: 'No Username' },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('password 필드 없이 요청하면 400을 반환한다 (edge case)', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: { username: 'nopass-user', displayName: 'No Password' },
    });

    expect(response.status()).toBe(400);
  });

  test('displayName 필드 없이 요청하면 400을 반환한다 (edge case)', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: { username: 'nodisplay-user', password: 'testpass123' },
    });

    expect(response.status()).toBe(400);
  });

  test('빈 바디로 요청하면 400을 반환한다 (edge case)', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: {},
    });

    expect(response.status()).toBe(400);
  });

  test('빈 문자열 username으로 요청하면 400을 반환한다 (edge case)', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: { username: '', password: 'testpass123', displayName: 'Empty Username' },
    });

    expect(response.status()).toBe(400);
  });

  test('빈 문자열 password로 요청하면 400을 반환한다 (edge case)', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: { username: 'emptypass-user', password: '', displayName: 'Empty Password' },
    });

    expect(response.status()).toBe(400);
  });

  test('빈 문자열 displayName으로 요청하면 400을 반환한다 (edge case)', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: { username: 'emptydisplay-user', password: 'testpass123', displayName: '' },
    });

    expect(response.status()).toBe(400);
  });

  test('/api/auth/signup 경로는 토큰 없이 접근 가능하다 (공개 경로)', async ({ request }) => {
    // 미들웨어가 공개 경로를 올바르게 통과시키는지 확인
    const response = await request.post('/api/auth/signup', {
      data: {},
    });

    // 미들웨어 블록(401)이 아닌 핸들러 응답(400)이어야 함
    expect(response.status()).toBe(400);
    expect(response.status()).not.toBe(401);
  });
});
