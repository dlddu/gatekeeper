/**
 * middleware.ts 검증 테스트
 *
 * publicPaths 설정과 미들웨어 파일의 구조적 요구사항을 검증합니다.
 * Forward Auth 기반으로 변경된 미들웨어를 정적 분석합니다.
 * (JWT 검증 로직이 제거되고 Authentik Forward Auth 헤더 기반 인증으로 대체)
 *
 * 런타임 동작 테스트:
 * - /api/* 경로에서 X-authentik-uid 헤더 없으면 401
 * - publicPaths는 헤더 없이도 통과
 * - 헤더가 있으면 정상 통과
 */

import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

const MIDDLEWARE_PATH = path.join(process.cwd(), 'middleware.ts');

describe('middleware.ts', () => {
  let middlewareContent: string;

  beforeAll(() => {
    middlewareContent = fs.readFileSync(MIDDLEWARE_PATH, 'utf-8');
  });

  it('should exist', () => {
    expect(fs.existsSync(MIDDLEWARE_PATH)).toBe(true);
  });

  it('should not be empty', () => {
    expect(middlewareContent.trim().length).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // publicPaths 내용 검증
  // ----------------------------------------------------------------
  describe('publicPaths', () => {
    it('should NOT import from lib/auth (deleted in Forward Auth migration)', () => {
      expect(middlewareContent).not.toMatch(/from ['"]@\/lib\/auth['"]/);
      expect(middlewareContent).not.toMatch(/from ['"]\.\.\/lib\/auth['"]/);
    });

    it('should NOT contain /api/auth/login in publicPaths (auth routes deleted)', () => {
      // Forward Auth 환경에서는 Authentik이 인증을 담당하므로
      // /api/auth/login 라우트 자체가 삭제되어 publicPaths에서도 제거된다
      expect(middlewareContent).not.toContain('/api/auth/login');
    });

    it('should NOT contain /api/auth/oidc/authorize in publicPaths (OIDC routes deleted)', () => {
      expect(middlewareContent).not.toContain('/api/auth/oidc/authorize');
    });

    it('should NOT contain /api/auth/oidc/callback in publicPaths (OIDC routes deleted)', () => {
      expect(middlewareContent).not.toContain('/api/auth/oidc/callback');
    });

    it('should NOT contain /login in publicPaths (login page deleted)', () => {
      // Forward Auth 환경에서는 Authentik이 로그인 페이지를 제공하므로
      // /login 경로가 삭제된다
      expect(middlewareContent).not.toContain('/login');
    });

    it('should include /api/health in publicPaths', () => {
      expect(middlewareContent).toContain('/api/health');
    });
  });

  // ----------------------------------------------------------------
  // Forward Auth 구조 검증
  // ----------------------------------------------------------------
  describe('Forward Auth structure', () => {
    it('should NOT use verifyToken (JWT auth removed)', () => {
      expect(middlewareContent).not.toContain('verifyToken');
    });

    it('should NOT reference JWT_SECRET (JWT auth removed)', () => {
      expect(middlewareContent).not.toContain('JWT_SECRET');
    });
  });

  // ----------------------------------------------------------------
  // 미들웨어 구조 검증
  // ----------------------------------------------------------------
  describe('middleware structure', () => {
    it('should export middleware function', () => {
      expect(middlewareContent).toMatch(/export async function middleware/);
    });

    it('should export config with matcher', () => {
      expect(middlewareContent).toContain('export const config');
      expect(middlewareContent).toContain('matcher');
    });
  });

});

// ----------------------------------------------------------------
// 미들웨어 런타임 동작 테스트
//
// middleware 함수를 직접 import하여 요청/응답 흐름을 검증합니다.
// X-authentik-uid 헤더 유무에 따른 인증 동작과
// publicPaths의 통과 여부를 테스트합니다.
// ----------------------------------------------------------------

// Next.js 서버 환경을 시뮬레이션하기 위한 mock
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      next: jest.fn(() => ({ status: 200, headers: new Map() })),
      json: jest.fn((body: unknown, init?: { status?: number }) => ({
        status: init?.status ?? 200,
        body: JSON.stringify(body),
        json: async () => body,
      })),
    },
  };
});

import { middleware } from '@/middleware';

const mockNextResponseNext = NextResponse.next as jest.Mock;
const mockNextResponseJson = NextResponse.json as jest.Mock;

function makeMiddlewareRequest(pathname: string, headers: Record<string, string> = {}): NextRequest {
  const url = `http://localhost${pathname}`;
  return new NextRequest(url, { headers });
}

describe('middleware 런타임 동작', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 기본 mock 반환값 설정
    mockNextResponseNext.mockReturnValue({ status: 200 });
    mockNextResponseJson.mockImplementation((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body: JSON.stringify(body),
      json: async () => body,
    }));
  });

  // ----------------------------------------------------------------
  // /api/* 경로에서 X-authentik-uid 헤더 없으면 401
  // ----------------------------------------------------------------
  describe('/api/* 경로 — X-authentik-uid 헤더 없으면 401', () => {
    it('/api/me 경로에서 x-authentik-uid 헤더가 없으면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeMiddlewareRequest('/api/me');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('/api/me/requests/pending 경로에서 헤더 없으면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeMiddlewareRequest('/api/me/requests/pending');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('/api/push/subscribe 경로에서 헤더 없으면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeMiddlewareRequest('/api/push/subscribe');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('401 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      const request = makeMiddlewareRequest('/api/me');

      // Act
      const response = await middleware(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
    });
  });

  // ----------------------------------------------------------------
  // publicPaths는 헤더 없이도 통과
  // ----------------------------------------------------------------
  describe('publicPaths — X-authentik-uid 헤더 없이도 통과', () => {
    it('/api/health는 헤더 없이도 NextResponse.next()를 호출해야 한다', async () => {
      // Arrange
      const request = makeMiddlewareRequest('/api/health');

      // Act
      await middleware(request);

      // Assert
      expect(mockNextResponseNext).toHaveBeenCalled();
    });

    it('/api/requests는 헤더 없이도 NextResponse.next()를 호출해야 한다', async () => {
      // Arrange
      const request = makeMiddlewareRequest('/api/requests');

      // Act
      await middleware(request);

      // Assert
      expect(mockNextResponseNext).toHaveBeenCalled();
    });

    it('/api/requests/some-id는 헤더 없이도 NextResponse.next()를 호출해야 한다', async () => {
      // Arrange
      const request = makeMiddlewareRequest('/api/requests/req-uuid-001');

      // Act
      await middleware(request);

      // Assert
      expect(mockNextResponseNext).toHaveBeenCalled();
    });

    it('/_next/static 경로는 헤더 없이도 NextResponse.next()를 호출해야 한다', async () => {
      // Arrange
      const request = makeMiddlewareRequest('/_next/static/chunks/main.js');

      // Act
      await middleware(request);

      // Assert
      expect(mockNextResponseNext).toHaveBeenCalled();
    });

    it('/favicon.ico는 헤더 없이도 NextResponse.next()를 호출해야 한다', async () => {
      // Arrange
      const request = makeMiddlewareRequest('/favicon.ico');

      // Act
      await middleware(request);

      // Assert
      expect(mockNextResponseNext).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // X-authentik-uid 헤더가 있으면 정상 통과
  // ----------------------------------------------------------------
  describe('X-authentik-uid 헤더가 있으면 정상 통과', () => {
    it('/api/me에서 x-authentik-uid 헤더가 있으면 NextResponse.next()를 호출해야 한다', async () => {
      // Arrange
      const request = makeMiddlewareRequest('/api/me', {
        'x-authentik-uid': 'uid-test-001',
      });

      // Act
      await middleware(request);

      // Assert
      expect(mockNextResponseNext).toHaveBeenCalled();
    });

    it('/api/me/requests/pending에서 헤더가 있으면 NextResponse.next()를 호출해야 한다', async () => {
      // Arrange
      const request = makeMiddlewareRequest('/api/me/requests/pending', {
        'x-authentik-uid': 'uid-test-001',
      });

      // Act
      await middleware(request);

      // Assert
      expect(mockNextResponseNext).toHaveBeenCalled();
    });

    it('헤더가 있으면 401을 반환하지 않아야 한다', async () => {
      // Arrange
      const request = makeMiddlewareRequest('/api/me', {
        'x-authentik-uid': 'uid-test-001',
      });

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(401);
    });
  });
});
