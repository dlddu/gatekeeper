import { type Page, type APIRequestContext } from '@playwright/test';

/**
 * E2E 테스트용 인증 헬퍼
 *
 * DLD-827: Forward Auth 헤더 기반으로 변경
 *
 * Authentik Forward Auth 헤더를 사용하는 유틸리티
 */

export interface AuthHeaders {
  authentikUid: string;
  authentikUsername: string;
  authentikEmail: string;
}

/**
 * 미리 정의된 테스트 계정 정보
 * global-setup.ts의 seedDatabase()에서 생성된 사용자와 일치해야 합니다.
 */
export const TEST_USERS = {
  admin: {
    username: 'admin',
    authentikUid: 'e2e-admin-uid-001',
    displayName: 'E2E Test Admin',
    email: 'admin@example.com',
  },
  user: {
    username: 'testuser',
    authentikUid: 'e2e-user-uid-001',
    displayName: 'E2E Test User',
    email: 'testuser@example.com',
  },
} as const;

/**
 * Forward Auth 헤더를 포함한 API 요청 옵션 생성
 */
export function withAuthHeader(authentikUid: string, username?: string, email?: string): { headers: Record<string, string> } {
  return {
    headers: {
      'x-authentik-uid': authentikUid,
      'x-authentik-username': username ?? '',
      'x-authentik-email': email ?? '',
    },
  };
}

/**
 * 관리자 계정의 Forward Auth 헤더 반환
 */
export async function loginAsAdmin(_request: APIRequestContext): Promise<AuthHeaders> {
  return {
    authentikUid: TEST_USERS.admin.authentikUid,
    authentikUsername: TEST_USERS.admin.username,
    authentikEmail: TEST_USERS.admin.email,
  };
}

/**
 * 일반 테스트 사용자의 Forward Auth 헤더 반환
 */
export async function loginAsTestUser(_request: APIRequestContext): Promise<AuthHeaders> {
  return {
    authentikUid: TEST_USERS.user.authentikUid,
    authentikUsername: TEST_USERS.user.username,
    authentikEmail: TEST_USERS.user.email,
  };
}

/**
 * 브라우저에서 프로그래매틱하게 인증 설정
 */
export async function loginViaAPI(
  page: Page,
  _request: APIRequestContext,
  user: typeof TEST_USERS.admin | typeof TEST_USERS.user = TEST_USERS.admin
): Promise<AuthHeaders> {
  // Forward Auth: set headers on all requests from this page (simulates Traefik)
  await page.setExtraHTTPHeaders({
    'x-authentik-uid': user.authentikUid,
    'x-authentik-username': user.username,
    'x-authentik-email': user.email,
  });
  return {
    authentikUid: user.authentikUid,
    authentikUsername: user.username,
    authentikEmail: user.email,
  };
}
