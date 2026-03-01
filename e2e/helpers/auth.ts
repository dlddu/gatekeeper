import { type APIRequestContext } from '@playwright/test';

/**
 * E2E 테스트용 인증 헬퍼
 *
 * DLD-647: e2e 테스트 환경 구성
 *
 * JWT 토큰 획득 및 인증된 API 요청을 위한 유틸리티
 */

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthToken {
  token: string;
  userId: string;
  username: string;
}

/**
 * 미리 정의된 테스트 계정 정보
 * global-setup.ts의 seedDatabase()에서 생성된 사용자와 일치해야 합니다.
 */
export const TEST_USERS = {
  admin: {
    username: 'admin',
    password: 'adminpass123',
    displayName: 'E2E Test Admin',
  },
  user: {
    username: 'testuser',
    password: 'userpass123',
    displayName: 'E2E Test User',
  },
} as const;

/**
 * POST /api/auth/login 호출로 JWT 토큰 획득
 */
export async function login(
  request: APIRequestContext,
  credentials: LoginCredentials
): Promise<AuthToken> {
  const response = await request.post('/api/auth/login', {
    data: credentials,
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(
      `Login failed: ${response.status()} ${response.statusText()} - ${body}`
    );
  }

  const body = await response.json();
  return {
    token: body.token,
    userId: body.userId,
    username: body.username,
  };
}

/**
 * Authorization 헤더를 포함한 API 요청 옵션 생성
 */
export function withAuthHeader(token: string): { headers: Record<string, string> } {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

/**
 * 관리자 계정으로 로그인하여 토큰 반환
 */
export async function loginAsAdmin(request: APIRequestContext): Promise<AuthToken> {
  return login(request, TEST_USERS.admin);
}

/**
 * 일반 테스트 사용자로 로그인하여 토큰 반환
 */
export async function loginAsTestUser(request: APIRequestContext): Promise<AuthToken> {
  return login(request, TEST_USERS.user);
}
