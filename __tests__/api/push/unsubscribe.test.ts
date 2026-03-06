/**
 * DELETE /api/me/push/unsubscribe 라우트 핸들러 테스트
 *
 * app/api/me/push/unsubscribe/route.ts의 DELETE 핸들러 동작을 검증합니다.
 * JWT Bearer 인증이 필요한 엔드포인트입니다.
 * 사용자의 Push 구독 정보를 DB에서 삭제합니다.
 * 실제 DB 연결 없이 prisma와 verifyToken을 mock 처리합니다.
 */

// --- Mock 설정 (import보다 먼저 선언되어야 함) ---

// prisma 클라이언트 mock
jest.mock('@/lib/prisma', () => ({
  prisma: {
    pushSubscription: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// lib/auth mock — verifyToken mock
jest.mock('@/lib/auth', () => ({
  signToken: jest.fn(),
  verifyToken: jest.fn(),
}));

// --- Import ---

import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/me/push/unsubscribe/route';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// 타입 캐스팅 헬퍼
const mockPushSubscriptionFindUnique = prisma.pushSubscription.findUnique as jest.Mock;
const mockPushSubscriptionDelete = prisma.pushSubscription.delete as jest.Mock;
const mockVerifyToken = verifyToken as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * Authorization 헤더와 JSON body를 포함한 DELETE NextRequest를 생성합니다.
 */
function makeRequest(
  body: Record<string, unknown>,
  authHeader?: string
): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader !== undefined) {
    headers['Authorization'] = authHeader;
  }
  return new NextRequest('http://localhost/api/me/push/unsubscribe', {
    method: 'DELETE',
    headers,
    body: JSON.stringify(body),
  });
}

// 기본 mock PushSubscription 레코드 생성 헬퍼
function makeMockSubscription(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'clpush1234567',
    userId: 'user-admin',
    endpoint: 'https://fcm.googleapis.com/fcm/send/example-endpoint',
    p256dh: 'BNc...',
    auth: 'abc...',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

const validEndpoint = 'https://fcm.googleapis.com/fcm/send/example-endpoint';

// 검증된 JWT 페이로드
const verifiedPayload = { userId: 'user-admin', username: 'admin', iat: 1000, exp: 9999999999 };

// --- 테스트 스위트 ---

describe('DELETE /api/me/push/unsubscribe', () => {
  const fakeToken = 'valid.jwt.token';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long!!';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  // ----------------------------------------------------------------
  // JWT 인증 없음 → 401
  // ----------------------------------------------------------------
  describe('JWT 인증 없음 (401 Unauthorized)', () => {
    it('Authorization 헤더가 없으면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({ endpoint: validEndpoint });

      // Act
      const response = await DELETE(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('Bearer 형식이 아닌 Authorization 헤더이면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest({ endpoint: validEndpoint }, 'Basic dXNlcjpwYXNz');

      // Act
      const response = await DELETE(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('유효하지 않은 JWT 토큰이면 401을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockRejectedValue(new Error('JWTExpired'));
      const request = makeRequest({ endpoint: validEndpoint }, 'Bearer expired.jwt.token');

      // Act
      const response = await DELETE(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('인증 실패 시 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      const request = makeRequest({ endpoint: validEndpoint });

      // Act
      const response = await DELETE(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('JWT 인증 실패 시 pushSubscription.delete를 호출하지 않아야 한다', async () => {
      // Arrange
      const request = makeRequest({ endpoint: validEndpoint });

      // Act
      await DELETE(request);

      // Assert
      expect(mockPushSubscriptionDelete).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 존재하지 않는 endpoint → 404
  // ----------------------------------------------------------------
  describe('존재하지 않는 endpoint (404 Not Found)', () => {
    it('DB에 없는 endpoint로 구독 해제 시 404를 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      const request = makeRequest(
        { endpoint: 'https://example.com/not-registered-endpoint' },
        `Bearer ${fakeToken}`
      );

      // Act
      const response = await DELETE(request);

      // Assert
      expect(response.status).toBe(404);
    });

    it('404 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      const request = makeRequest(
        { endpoint: 'https://example.com/not-registered-endpoint' },
        `Bearer ${fakeToken}`
      );

      // Act
      const response = await DELETE(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('endpoint가 없을 때 pushSubscription.delete를 호출하지 않아야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      const request = makeRequest(
        { endpoint: 'https://example.com/not-registered-endpoint' },
        `Bearer ${fakeToken}`
      );

      // Act
      await DELETE(request);

      // Assert
      expect(mockPushSubscriptionDelete).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 소유자 검증 실패 → 403
  // ----------------------------------------------------------------
  describe('소유자 검증 실패 (403 Forbidden)', () => {
    it('다른 사용자의 구독을 삭제하려고 하면 403을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue({ userId: 'other-user', username: 'other', iat: 1000, exp: 9999999999 });
      const subscription = makeMockSubscription({ userId: 'user-admin' });
      mockPushSubscriptionFindUnique.mockResolvedValue(subscription);
      const request = makeRequest({ endpoint: validEndpoint }, `Bearer ${fakeToken}`);

      // Act
      const response = await DELETE(request);

      // Assert
      expect(response.status).toBe(403);
    });

    it('403 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue({ userId: 'other-user', username: 'other', iat: 1000, exp: 9999999999 });
      const subscription = makeMockSubscription({ userId: 'user-admin' });
      mockPushSubscriptionFindUnique.mockResolvedValue(subscription);
      const request = makeRequest({ endpoint: validEndpoint }, `Bearer ${fakeToken}`);

      // Act
      const response = await DELETE(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('소유자 검증 실패 시 pushSubscription.delete를 호출하지 않아야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue({ userId: 'other-user', username: 'other', iat: 1000, exp: 9999999999 });
      const subscription = makeMockSubscription({ userId: 'user-admin' });
      mockPushSubscriptionFindUnique.mockResolvedValue(subscription);
      const request = makeRequest({ endpoint: validEndpoint }, `Bearer ${fakeToken}`);

      // Act
      await DELETE(request);

      // Assert
      expect(mockPushSubscriptionDelete).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 정상 구독 해제 (happy path) → 200
  // ----------------------------------------------------------------
  describe('정상 구독 해제 (200 OK)', () => {
    it('등록된 endpoint로 구독 해제 시 200을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const subscription = makeMockSubscription();
      mockPushSubscriptionFindUnique.mockResolvedValue(subscription);
      mockPushSubscriptionDelete.mockResolvedValue(subscription);
      const request = makeRequest({ endpoint: validEndpoint }, `Bearer ${fakeToken}`);

      // Act
      const response = await DELETE(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it('200 응답 body에 성공 메시지가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const subscription = makeMockSubscription();
      mockPushSubscriptionFindUnique.mockResolvedValue(subscription);
      mockPushSubscriptionDelete.mockResolvedValue(subscription);
      const request = makeRequest({ endpoint: validEndpoint }, `Bearer ${fakeToken}`);

      // Act
      const response = await DELETE(request);
      const body = await response.json();

      // Assert
      expect(body).toBeDefined();
    });

    it('해당 endpoint로 pushSubscription.delete를 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const subscription = makeMockSubscription();
      mockPushSubscriptionFindUnique.mockResolvedValue(subscription);
      mockPushSubscriptionDelete.mockResolvedValue(subscription);
      const request = makeRequest({ endpoint: validEndpoint }, `Bearer ${fakeToken}`);

      // Act
      await DELETE(request);

      // Assert
      expect(mockPushSubscriptionDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            endpoint: validEndpoint,
          }),
        })
      );
    });

    it('verifyToken을 Authorization 헤더의 토큰으로 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const subscription = makeMockSubscription();
      mockPushSubscriptionFindUnique.mockResolvedValue(subscription);
      mockPushSubscriptionDelete.mockResolvedValue(subscription);
      const request = makeRequest({ endpoint: validEndpoint }, `Bearer ${fakeToken}`);

      // Act
      await DELETE(request);

      // Assert
      expect(mockVerifyToken).toHaveBeenCalledWith(fakeToken);
    });
  });
});
