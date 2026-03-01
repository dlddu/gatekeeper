/**
 * POST /api/auth/refresh 라우트 핸들러 테스트
 *
 * app/api/auth/refresh/route.ts의 동작을 검증합니다.
 * verifyToken, signToken을 mock 처리하여 실제 JWT 연산 없이 테스트합니다.
 */

// --- Mock 설정 (import보다 먼저 선언되어야 함) ---

// lib/auth mock — verifyToken, signToken 모두 mock
jest.mock('@/lib/auth', () => ({
  signToken: jest.fn(),
  verifyToken: jest.fn(),
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/refresh/route';
import { signToken, verifyToken } from '@/lib/auth';

// 타입 캐스팅 헬퍼
const mockVerifyToken = verifyToken as jest.Mock;
const mockSignToken = signToken as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * Authorization 헤더를 포함한 NextRequest를 생성합니다.
 */
function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers['Authorization'] = authHeader;
  }
  return new NextRequest('http://localhost/api/auth/refresh', {
    method: 'POST',
    headers,
  });
}

// --- 테스트 스위트 ---

describe('POST /api/auth/refresh', () => {
  const testSecret = 'test-secret-key-at-least-32-chars-long!!';
  const fakeOldToken = 'old.jwt.token';
  const fakeNewToken = 'new.jwt.token';
  const verifiedPayload = { userId: 'user-1', username: 'alice', iat: 1000, exp: 2000 };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = testSecret;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  // ----------------------------------------------------------------
  // Authorization 헤더 없음 또는 토큰 없음 → 401
  // ----------------------------------------------------------------
  describe('토큰 없음 (401 Unauthorized)', () => {
    it('Authorization 헤더가 없으면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest();

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('Authorization 헤더가 없을 때 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      const request = makeRequest();

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });
  });

  // ----------------------------------------------------------------
  // 유효하지 않은 토큰 → 401
  // ----------------------------------------------------------------
  describe('유효하지 않은 토큰 (401 Unauthorized)', () => {
    it('verifyToken이 예외를 던지면 401을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockRejectedValue(new Error('JWTExpired'));
      const request = makeRequest(`Bearer ${fakeOldToken}`);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('만료된 토큰에 대해 401 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockRejectedValue(new Error('JWTExpired'));
      const request = makeRequest(`Bearer ${fakeOldToken}`);

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('서명이 잘못된 토큰에 대해 401을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockRejectedValue(new Error('JWSInvalid'));
      const request = makeRequest('Bearer invalid.token.here');

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('형식이 잘못된 토큰에 대해 401을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockRejectedValue(new Error('JWTMalformed'));
      const request = makeRequest('Bearer notajwtatall');

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('verifyToken을 헤더에서 추출한 토큰으로 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockRejectedValue(new Error('Invalid'));
      const request = makeRequest(`Bearer ${fakeOldToken}`);

      // Act
      await POST(request);

      // Assert
      expect(mockVerifyToken).toHaveBeenCalledWith(fakeOldToken);
    });
  });

  // ----------------------------------------------------------------
  // 유효한 토큰 → 새 토큰 반환 (200)
  // ----------------------------------------------------------------
  describe('유효한 토큰 (200 OK)', () => {
    it('유효한 토큰으로 200을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockSignToken.mockResolvedValue(fakeNewToken);
      const request = makeRequest(`Bearer ${fakeOldToken}`);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it('응답 body에 새 token이 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockSignToken.mockResolvedValue(fakeNewToken);
      const request = makeRequest(`Bearer ${fakeOldToken}`);

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('token');
      expect(body.token).toBe(fakeNewToken);
    });

    it('새 토큰은 기존 토큰과 달라야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockSignToken.mockResolvedValue(fakeNewToken);
      const request = makeRequest(`Bearer ${fakeOldToken}`);

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body.token).not.toBe(fakeOldToken);
    });

    it('signToken을 기존 토큰의 userId와 username으로 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockSignToken.mockResolvedValue(fakeNewToken);
      const request = makeRequest(`Bearer ${fakeOldToken}`);

      // Act
      await POST(request);

      // Assert
      expect(mockSignToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          username: 'alice',
        })
      );
    });

    it('verifyToken을 Bearer 접두사 없이 순수 토큰 값으로 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockSignToken.mockResolvedValue(fakeNewToken);
      const request = makeRequest(`Bearer ${fakeOldToken}`);

      // Act
      await POST(request);

      // Assert — "Bearer " 접두사가 제거된 토큰만 전달되어야 함
      expect(mockVerifyToken).toHaveBeenCalledWith(fakeOldToken);
      expect(mockVerifyToken).not.toHaveBeenCalledWith(`Bearer ${fakeOldToken}`);
    });
  });
});
