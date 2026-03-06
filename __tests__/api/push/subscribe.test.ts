/**
 * POST /api/me/push/subscribe 라우트 핸들러 테스트
 *
 * app/api/me/push/subscribe/route.ts의 POST 핸들러 동작을 검증합니다.
 * JWT Bearer 인증이 필요한 엔드포인트입니다.
 * 사용자의 Push 구독 정보를 DB에 등록합니다.
 * 실제 DB 연결 없이 prisma와 verifyToken을 mock 처리합니다.
 */

// --- Mock 설정 (import보다 먼저 선언되어야 함) ---

// prisma 클라이언트 mock
jest.mock('@/lib/prisma', () => ({
  prisma: {
    pushSubscription: {
      create: jest.fn(),
      findUnique: jest.fn(),
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
import { POST } from '@/app/api/me/push/subscribe/route';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// 타입 캐스팅 헬퍼
const mockPushSubscriptionCreate = prisma.pushSubscription.create as jest.Mock;
const mockPushSubscriptionFindUnique = prisma.pushSubscription.findUnique as jest.Mock;
const mockVerifyToken = verifyToken as jest.Mock;

// --- 테스트 헬퍼 ---

/**
 * Authorization 헤더와 JSON body를 포함한 POST NextRequest를 생성합니다.
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
  return new NextRequest('http://localhost/api/me/push/subscribe', {
    method: 'POST',
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

// 유효한 구독 body
const validBody = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/example-endpoint',
  keys: {
    p256dh: 'BNc...',
    auth: 'abc...',
  },
};

// 검증된 JWT 페이로드
const verifiedPayload = { userId: 'user-admin', username: 'admin', iat: 1000, exp: 9999999999 };

// --- 테스트 스위트 ---

describe('POST /api/me/push/subscribe', () => {
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
      const request = makeRequest(validBody);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('Bearer 형식이 아닌 Authorization 헤더이면 401을 반환해야 한다', async () => {
      // Arrange
      const request = makeRequest(validBody, 'Basic dXNlcjpwYXNz');

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('유효하지 않은 JWT 토큰이면 401을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockRejectedValue(new Error('JWTExpired'));
      const request = makeRequest(validBody, 'Bearer expired.jwt.token');

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('인증 실패 시 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      const request = makeRequest(validBody);

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('JWT 인증 실패 시 pushSubscription.create를 호출하지 않아야 한다', async () => {
      // Arrange
      const request = makeRequest(validBody);

      // Act
      await POST(request);

      // Assert
      expect(mockPushSubscriptionCreate).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 필수 필드 누락 → 400
  // ----------------------------------------------------------------
  describe('필수 필드 누락 (400 Bad Request)', () => {
    it('endpoint가 없으면 400을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const request = makeRequest(
        { keys: { p256dh: 'BNc...', auth: 'abc...' } },
        `Bearer ${fakeToken}`
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('keys.p256dh가 없으면 400을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const request = makeRequest(
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/example-endpoint',
          keys: { auth: 'abc...' },
        },
        `Bearer ${fakeToken}`
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('keys.auth가 없으면 400을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const request = makeRequest(
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/example-endpoint',
          keys: { p256dh: 'BNc...' },
        },
        `Bearer ${fakeToken}`
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('keys 객체 자체가 없으면 400을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const request = makeRequest(
        { endpoint: 'https://fcm.googleapis.com/fcm/send/example-endpoint' },
        `Bearer ${fakeToken}`
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('endpoint가 빈 문자열이면 400을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const request = makeRequest(
        { endpoint: '', keys: { p256dh: 'BNc...', auth: 'abc...' } },
        `Bearer ${fakeToken}`
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('keys.p256dh가 빈 문자열이면 400을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const request = makeRequest(
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/example-endpoint',
          keys: { p256dh: '', auth: 'abc...' },
        },
        `Bearer ${fakeToken}`
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('keys.auth가 빈 문자열이면 400을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const request = makeRequest(
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/example-endpoint',
          keys: { p256dh: 'BNc...', auth: '' },
        },
        `Bearer ${fakeToken}`
      );

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('400 응답 body에 error 필드가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const request = makeRequest({}, `Bearer ${fakeToken}`);

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('error');
    });

    it('필드 누락 시 pushSubscription.create를 호출하지 않아야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const request = makeRequest({}, `Bearer ${fakeToken}`);

      // Act
      await POST(request);

      // Assert
      expect(mockPushSubscriptionCreate).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 중복 endpoint → 200 (기존 구독 반환)
  // ----------------------------------------------------------------
  describe('중복 endpoint (200 OK - 기존 구독 반환)', () => {
    it('이미 존재하는 endpoint로 구독 시도 시 200을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const existingSubscription = makeMockSubscription();
      mockPushSubscriptionFindUnique.mockResolvedValue(existingSubscription);
      const request = makeRequest(validBody, `Bearer ${fakeToken}`);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it('중복 endpoint 시 응답 body에 기존 구독 id가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      const existingSubscription = makeMockSubscription({ id: 'existing-sub-id' });
      mockPushSubscriptionFindUnique.mockResolvedValue(existingSubscription);
      const request = makeRequest(validBody, `Bearer ${fakeToken}`);

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('id');
      expect(body.id).toBe('existing-sub-id');
    });

    it('중복 endpoint 시 pushSubscription.create를 호출하지 않아야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockPushSubscriptionFindUnique.mockResolvedValue(makeMockSubscription());
      const request = makeRequest(validBody, `Bearer ${fakeToken}`);

      // Act
      await POST(request);

      // Assert
      expect(mockPushSubscriptionCreate).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 정상 구독 등록 (happy path) → 201
  // ----------------------------------------------------------------
  describe('정상 구독 등록 (201 Created)', () => {
    it('유효한 데이터로 구독 시 201을 반환해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      const mockRecord = makeMockSubscription();
      mockPushSubscriptionCreate.mockResolvedValue(mockRecord);
      const request = makeRequest(validBody, `Bearer ${fakeToken}`);

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(201);
    });

    it('201 응답 body에 생성된 구독의 id가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      const mockRecord = makeMockSubscription({ id: 'new-sub-id' });
      mockPushSubscriptionCreate.mockResolvedValue(mockRecord);
      const request = makeRequest(validBody, `Bearer ${fakeToken}`);

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('id');
      expect(body.id).toBe('new-sub-id');
    });

    it('응답 body에 endpoint가 포함되어야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      const mockRecord = makeMockSubscription({
        endpoint: 'https://fcm.googleapis.com/fcm/send/example-endpoint',
      });
      mockPushSubscriptionCreate.mockResolvedValue(mockRecord);
      const request = makeRequest(validBody, `Bearer ${fakeToken}`);

      // Act
      const response = await POST(request);
      const body = await response.json();

      // Assert
      expect(body).toHaveProperty('endpoint');
      expect(body.endpoint).toBe('https://fcm.googleapis.com/fcm/send/example-endpoint');
    });

    it('인증된 사용자의 userId로 pushSubscription.create를 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      mockPushSubscriptionCreate.mockResolvedValue(makeMockSubscription());
      const request = makeRequest(validBody, `Bearer ${fakeToken}`);

      // Act
      await POST(request);

      // Assert
      expect(mockPushSubscriptionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: verifiedPayload.userId,
          }),
        })
      );
    });

    it('endpoint, p256dh, auth를 포함하여 pushSubscription.create를 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      mockPushSubscriptionCreate.mockResolvedValue(makeMockSubscription());
      const request = makeRequest(validBody, `Bearer ${fakeToken}`);

      // Act
      await POST(request);

      // Assert
      expect(mockPushSubscriptionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endpoint: validBody.endpoint,
            p256dh: validBody.keys.p256dh,
            auth: validBody.keys.auth,
          }),
        })
      );
    });

    it('verifyToken을 Authorization 헤더의 토큰으로 호출해야 한다', async () => {
      // Arrange
      mockVerifyToken.mockResolvedValue(verifiedPayload);
      mockPushSubscriptionFindUnique.mockResolvedValue(null);
      mockPushSubscriptionCreate.mockResolvedValue(makeMockSubscription());
      const request = makeRequest(validBody, `Bearer ${fakeToken}`);

      // Act
      await POST(request);

      // Assert
      expect(mockVerifyToken).toHaveBeenCalledWith(fakeToken);
    });
  });
});
