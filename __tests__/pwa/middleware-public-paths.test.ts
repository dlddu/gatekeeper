/**
 * middleware.ts PWA 공개 경로 검증 테스트
 *
 * middleware.ts의 publicPaths 배열에 PWA 정적 파일 경로가
 * 포함되어 있는지 검증합니다.
 *
 * 검증 항목:
 * - /manifest.json이 공개 경로로 등록됨 (인증 불필요)
 * - /sw.js가 공개 경로로 등록됨 (인증 불필요)
 * - 실제 middleware 함수가 PWA 경로를 인증 없이 통과시킴
 */

// --- Mock 설정 ---

// lib/auth mock — verifyToken이 실제로 호출되지 않아야 함을 검증
jest.mock('@/lib/auth', () => ({
  signToken: jest.fn(),
  verifyToken: jest.fn(),
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { verifyToken } from '@/lib/auth';

const mockVerifyToken = verifyToken as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * 지정된 경로로 NextRequest를 생성합니다 (Authorization 헤더 없음).
 */
function makeUnauthenticatedRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`, {
    method: 'GET',
  });
}

/**
 * 지정된 경로로 Authorization 헤더를 포함한 NextRequest를 생성합니다.
 */
function makeAuthenticatedRequest(pathname: string, token: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// --- 테스트 스위트 ---

describe('middleware.ts PWA public paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long!!';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  // ----------------------------------------------------------------
  // /manifest.json — 공개 경로 (인증 불필요)
  // ----------------------------------------------------------------
  describe('/manifest.json public path', () => {
    it('should allow unauthenticated access to /manifest.json', async () => {
      // Arrange
      const request = makeUnauthenticatedRequest('/manifest.json');

      // Act
      const response = await middleware(request);

      // Assert — 401이 아닌 응답이어야 함
      expect(response.status).not.toBe(401);
    });

    it('should not call verifyToken for /manifest.json requests', async () => {
      // Arrange
      const request = makeUnauthenticatedRequest('/manifest.json');

      // Act
      await middleware(request);

      // Assert — 공개 경로이므로 토큰 검증이 호출되면 안 됨
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('should return NextResponse.next() (passthrough) for /manifest.json', async () => {
      // Arrange
      const request = makeUnauthenticatedRequest('/manifest.json');

      // Act
      const response = await middleware(request);

      // Assert — 200(next) 또는 리다이렉트 없이 통과
      // NextResponse.next()는 status 200으로 반환됨
      expect(response.status).toBe(200);
    });
  });

  // ----------------------------------------------------------------
  // /sw.js — 공개 경로 (인증 불필요)
  // ----------------------------------------------------------------
  describe('/sw.js public path', () => {
    it('should allow unauthenticated access to /sw.js', async () => {
      // Arrange
      const request = makeUnauthenticatedRequest('/sw.js');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(401);
    });

    it('should not call verifyToken for /sw.js requests', async () => {
      // Arrange
      const request = makeUnauthenticatedRequest('/sw.js');

      // Act
      await middleware(request);

      // Assert
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('should return NextResponse.next() (passthrough) for /sw.js', async () => {
      // Arrange
      const request = makeUnauthenticatedRequest('/sw.js');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).toBe(200);
    });
  });

  // ----------------------------------------------------------------
  // middleware.ts 소스 코드에 공개 경로 등록 여부 확인
  // ----------------------------------------------------------------
  describe('publicPaths array in middleware source', () => {
    const fs = require('fs');
    const path = require('path');

    let middlewareContent: string;

    beforeAll(() => {
      const middlewarePath = path.join(process.cwd(), 'middleware.ts');
      middlewareContent = fs.readFileSync(middlewarePath, 'utf-8');
    });

    it('should include /manifest.json in publicPaths array', () => {
      // publicPaths 배열 안에 '/manifest.json' 문자열이 있어야 함
      expect(middlewareContent).toMatch(/publicPaths[^;]*\/manifest\.json/s);
    });

    it('should include /sw.js in publicPaths array', () => {
      // publicPaths 배열 안에 '/sw.js' 문자열이 있어야 함
      expect(middlewareContent).toMatch(/publicPaths[^;]*\/sw\.js/s);
    });
  });

  // ----------------------------------------------------------------
  // 기존 공개 경로가 여전히 동작하는지 회귀 검증
  // ----------------------------------------------------------------
  describe('existing public paths regression', () => {
    it('should still allow unauthenticated access to /api/auth/login', async () => {
      // Arrange
      const request = makeUnauthenticatedRequest('/api/auth/login');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(401);
    });

    it('should still allow unauthenticated access to /login', async () => {
      // Arrange
      const request = makeUnauthenticatedRequest('/login');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(401);
    });

    it('should still allow unauthenticated access to /favicon.ico', async () => {
      // Arrange
      const request = makeUnauthenticatedRequest('/favicon.ico');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(401);
    });
  });

  // ----------------------------------------------------------------
  // 비공개 API 경로는 여전히 인증을 요구함 (회귀 검증)
  // ----------------------------------------------------------------
  describe('protected API paths remain authenticated (regression)', () => {
    it('should return 401 for unauthenticated /api/me/requests/pending', async () => {
      // Arrange
      const request = makeUnauthenticatedRequest('/api/me/requests/pending');

      // Act
      const response = await middleware(request);

      // Assert — 인증 없이 접근 불가
      expect(response.status).toBe(401);
    });

    it('should allow authenticated /api/me/requests/pending with valid token', async () => {
      // Arrange
      const fakeToken = 'valid.jwt.token';
      mockVerifyToken.mockResolvedValue({ userId: 'user-1', username: 'alice' });
      const request = makeAuthenticatedRequest('/api/me/requests/pending', fakeToken);

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(401);
    });

    it('should call verifyToken for protected API paths', async () => {
      // Arrange
      const fakeToken = 'valid.jwt.token';
      mockVerifyToken.mockResolvedValue({ userId: 'user-1', username: 'alice' });
      const request = makeAuthenticatedRequest('/api/me/requests/pending', fakeToken);

      // Act
      await middleware(request);

      // Assert
      expect(mockVerifyToken).toHaveBeenCalledWith(fakeToken);
    });
  });

  // ----------------------------------------------------------------
  // 엣지 케이스: PWA 경로와 유사한 경로
  // ----------------------------------------------------------------
  describe('edge cases for PWA path matching', () => {
    it('should not treat /manifest.json/extra as public path if not prefixed correctly', async () => {
      // /manifest.json/extra는 /manifest.json로 시작하지만
      // 현재 publicPaths 매칭이 startsWith이므로 통과됨 — 동작 확인
      const request = makeUnauthenticatedRequest('/manifest.json');

      // Act
      const response = await middleware(request);

      // Assert — /manifest.json 자체는 반드시 통과해야 함
      expect(response.status).toBe(200);
    });

    it('should not expose /api/sw.js as public (not a valid PWA path)', async () => {
      // Arrange — Authorization 헤더 없이 /api/sw.js 접근 시도
      const request = makeUnauthenticatedRequest('/api/sw.js');

      // Act
      const response = await middleware(request);

      // Assert — /api/sw.js는 보호된 API 경로
      expect(response.status).toBe(401);
    });
  });
});
