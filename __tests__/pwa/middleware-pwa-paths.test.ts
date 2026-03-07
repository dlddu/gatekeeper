/**
 * middleware.ts PWA 공개 경로 통합 테스트
 *
 * middleware.ts의 isPublicPath 함수가 PWA 관련 경로를
 * 인증 없이 통과시키는지 검증합니다.
 *
 * 테스트 대상 경로:
 * - /manifest.json  (Next.js App Router manifest route)
 * - /sw.js          (Service Worker 파일)
 * - /icons/...      (PWA 아이콘 디렉토리)
 */

// verifyToken mock (middleware가 import하는 @/lib/auth)
jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

// ----------------------------------------------------------------
// 헬퍼: 주어진 경로로 NextRequest 생성
// ----------------------------------------------------------------
function makeRequest(pathname: string, options: { token?: string } = {}): NextRequest {
  const url = `http://localhost${pathname}`;
  const headers: Record<string, string> = {};
  if (options.token) {
    headers['authorization'] = `Bearer ${options.token}`;
  }
  return new NextRequest(url, { headers });
}

// ----------------------------------------------------------------
// 테스트 스위트
// ----------------------------------------------------------------
describe('middleware.ts - PWA 공개 경로', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // /manifest.json 경로
  // ----------------------------------------------------------------
  describe('/manifest.json', () => {
    it('토큰 없이 /manifest.json 요청이 통과되어야 한다 (happy path)', async () => {
      // Arrange
      const request = makeRequest('/manifest.json');

      // Act
      const response = await middleware(request);

      // Assert — 401이 아닌 응답이어야 함
      expect(response.status).not.toBe(401);
    });

    it('/manifest.json 응답이 NextResponse.next()로 처리되어야 한다', async () => {
      // Arrange
      const request = makeRequest('/manifest.json');

      // Act
      const response = await middleware(request);

      // Assert — next() 응답은 200 또는 기본 상태
      expect(response.status).toBeLessThan(400);
    });
  });

  // ----------------------------------------------------------------
  // /sw.js 경로
  // ----------------------------------------------------------------
  describe('/sw.js', () => {
    it('토큰 없이 /sw.js 요청이 통과되어야 한다 (happy path)', async () => {
      // Arrange
      const request = makeRequest('/sw.js');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(401);
    });

    it('/sw.js 응답이 NextResponse.next()로 처리되어야 한다', async () => {
      // Arrange
      const request = makeRequest('/sw.js');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).toBeLessThan(400);
    });
  });

  // ----------------------------------------------------------------
  // /icons/* 경로
  // ----------------------------------------------------------------
  describe('/icons/*', () => {
    it('토큰 없이 /icons/icon-192x192.png 요청이 통과되어야 한다 (happy path)', async () => {
      // Arrange
      const request = makeRequest('/icons/icon-192x192.png');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(401);
    });

    it('토큰 없이 /icons/icon-512x512.png 요청이 통과되어야 한다 (happy path)', async () => {
      // Arrange
      const request = makeRequest('/icons/icon-512x512.png');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(401);
    });

    it('/icons/ 하위 모든 경로가 공개 경로로 처리되어야 한다 (edge case)', async () => {
      // Arrange
      const request = makeRequest('/icons/apple-touch-icon.png');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(401);
    });
  });

  // ----------------------------------------------------------------
  // 기존 공개 경로가 여전히 동작하는지 확인 (회귀 테스트)
  // ----------------------------------------------------------------
  describe('기존 공개 경로 회귀 테스트', () => {
    it('/api/auth/login은 토큰 없이 통과되어야 한다', async () => {
      // Arrange
      const request = makeRequest('/api/auth/login');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(401);
    });

    it('/login 페이지는 토큰 없이 통과되어야 한다', async () => {
      // Arrange
      const request = makeRequest('/login');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(401);
    });

    it('/favicon.ico는 토큰 없이 통과되어야 한다', async () => {
      // Arrange
      const request = makeRequest('/favicon.ico');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).not.toBe(401);
    });
  });

  // ----------------------------------------------------------------
  // 보호된 경로는 여전히 인증 필요 (회귀 테스트)
  // ----------------------------------------------------------------
  describe('보호된 API 경로 회귀 테스트', () => {
    it('/api/me/requests/pending은 토큰 없이 401을 반환해야 한다', async () => {
      // Arrange — 토큰 없는 요청
      const request = makeRequest('/api/me/requests/pending');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('/api/me/push/subscribe는 토큰 없이 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest('/api/me/push/subscribe');

      // Act
      const response = await middleware(request);

      // Assert
      expect(response.status).toBe(401);
    });
  });
});

// ----------------------------------------------------------------
// middleware.ts 소스 코드 정적 분석
// ----------------------------------------------------------------
describe('middleware.ts - 소스 코드 구조 검증', () => {
  let middlewareContent: string;

  beforeAll(() => {
    middlewareContent = fs.readFileSync(
      path.join(process.cwd(), 'middleware.ts'),
      'utf-8'
    );
  });

  it('publicPaths 배열에 /manifest.json이 포함되어야 한다', () => {
    expect(middlewareContent).toMatch(/['"]\/manifest\.json['"]/);
  });

  it('publicPaths 배열에 /sw.js가 포함되어야 한다', () => {
    expect(middlewareContent).toMatch(/['"]\/sw\.js['"]/);
  });

  it('publicPaths 배열에 /icons가 포함되어야 한다', () => {
    expect(middlewareContent).toMatch(/['"]\/icons['"]/);
  });
});
